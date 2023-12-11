const adContainerClasses = [
  "full-bigyaapan",
  "bigyaapan-item",
  "insert-ad",
  "desktop-bigyaapan-only",
  "top-bigyaapan",
  "ad-item",
];

adContainerClasses.forEach(function (item) {
  document.querySelectorAll("." + item).forEach(function (node) {
    node.style.display = "none";
  });
});
