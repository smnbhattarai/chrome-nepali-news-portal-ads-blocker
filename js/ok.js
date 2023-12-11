const adContainerClasses = [
  "add__fullwidth",
  "ok-details-adv-in-left",
  "okam-ad-position-wrap",
  "nh_widget_wrap",
  "ok-full-widht-adv"
];

adContainerClasses.forEach(function (item) {
  document.querySelectorAll("." + item).forEach(function (node) {
    node.style.display = "none";
  });
});
