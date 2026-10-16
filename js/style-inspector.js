(() => {
  if (!new URLSearchParams(window.location.search).has('styles')) return;

  document.body.classList.add('style-inspection');

  const labelFor = (element) => {
    const styles = window.getComputedStyle(element);
    const name = element.tagName.toLowerCase();
    const size = Math.round(parseFloat(styles.fontSize));
    const lineHeight = Math.round(parseFloat(styles.lineHeight));
    const weight = styles.fontWeight;
    return `${name} · ${size}px / ${lineHeight}px · ${weight}`;
  };

  document.querySelectorAll('h1, h2, h3, main > p, main section > p').forEach((element) => {
    element.dataset.styleLabel = labelFor(element);
  });
})();
