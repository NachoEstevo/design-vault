(() => {
  if (globalThis.__designShelfCaptureInstalled) return;
  globalThis.__designShelfCaptureInstalled = true;
  const inFlight = new Set();
  const queued = new Set();
  const queue = [];
  let showing = false;

  function own(node, tweet) {
    if (node.closest('[data-testid="tweet"]') !== tweet) return false;
    const quote = node.closest('[data-testid="quoteTweet"],div[role="link"]');
    return !quote || !tweet.contains(quote);
  }

  function readPost(tweet) {
    const link = Array.from(tweet.querySelectorAll('a[href*="/status/"]')).find(
      (a) => a.querySelector("time") && own(a, tweet),
    );
    if (!link) return null;
    const match = new URL(link.href, location.href).pathname.match(
      /^\/([A-Za-z0-9_]+)\/status\/([1-9][0-9]{0,24})/,
    );
    if (!match) return null;
    const images = Array.from(
      tweet.querySelectorAll('[data-testid="tweetPhoto"] img'),
    )
      .filter((img) => own(img, tweet))
      .map((img) => {
        try {
          const url = new URL(img.currentSrc || img.src);
          if (
            url.protocol !== "https:" ||
            url.hostname !== "pbs.twimg.com" ||
            !url.pathname.startsWith("/media/")
          )
            return null;
          return { sourceUrl: url.href };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    const unique = Array.from(
      new Map(images.map((i) => [i.sourceUrl, i])).values(),
    ).slice(0, 4);
    if (!unique.length) return null;
    const text =
      Array.from(tweet.querySelectorAll('[data-testid="tweetText"]')).find(
        (node) => own(node, tweet),
      )?.textContent || "";
    return {
      postId: match[2],
      url: `https://x.com/${match[1]}/status/${match[2]}`,
      author: `@${match[1]}`,
      text,
      images: unique,
    };
  }

  async function send(type, data = {}) {
    const response = await chrome.runtime.sendMessage({ type, ...data });
    if (!response?.ok)
      throw new Error(
        response?.error?.message ||
          "The extension was reloaded. Reload this X tab to use it again.",
      );
    return response.result;
  }

  async function drain() {
    if (showing || !queue.length) return;
    showing = true;
    const { post, button } = queue.shift();
    try {
      const settings = await send("GET_SETTINGS");
      await globalThis.DesignShelfModal.open(post, {
        settings,
        onSave: (reference) => send("SAVE_REFERENCE", { reference }),
        onAddCategory: (label) => send("ADD_CATEGORY", { label }),
        onOpenLibrary: () => send("OPEN_LIBRARY"),
        onRefreshSettings: () => send("GET_SETTINGS"),
        returnFocus: button,
      });
    } catch (error) {
      globalThis.DesignShelfModal.notify(error.message, true);
    } finally {
      queued.delete(post.postId);
      showing = false;
      drain();
    }
  }

  function waitForLike(tweet, post) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (liked) => {
        if (done) return;
        done = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(liked);
      };
      const check = () => {
        const candidates =
          tweet.isConnected && readPost(tweet)?.postId === post.postId
            ? [tweet]
            : Array.from(document.querySelectorAll('[data-testid="tweet"]'));
        for (const candidate of candidates) {
          if (readPost(candidate)?.postId !== post.postId) continue;
          if (
            Array.from(
              candidate.querySelectorAll('[data-testid="unlike"]'),
            ).some((button) => own(button, candidate))
          ) {
            finish(true);
            return;
          }
        }
      };
      const observer = new MutationObserver(check);
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-testid"],
      });
      const timer = setTimeout(() => finish(false), 4000);
      check();
    });
  }

  document.addEventListener(
    "click",
    async (event) => {
      if (!(event.target instanceof Element) || !event.isTrusted) return;
      const button = event.target.closest('[data-testid="like"]');
      const tweet = button?.closest('[data-testid="tweet"]');
      if (!tweet || !own(button, tweet)) return;
      const post = readPost(tweet);
      if (!post || inFlight.has(post.postId) || queued.has(post.postId)) return;
      inFlight.add(post.postId);
      try {
        if (!(await waitForLike(tweet, post))) return;
        if (queue.length >= 8) {
          globalThis.DesignShelfModal.notify(
            "Several references are open. Finish them, then like this post again.",
          );
          return;
        }
        queued.add(post.postId);
        queue.push({ post, button });
        drain();
      } finally {
        inFlight.delete(post.postId);
      }
    },
    true,
  );
})();
