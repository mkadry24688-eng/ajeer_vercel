const params = new URLSearchParams(window.location.search);
const id = params.get("i");

if (id) {
  window.location.replace(
    window.location.origin +
      "/ajeer/verify.html?id=" +
      encodeURIComponent(id)
  );
} else {
  window.onload = function () {
    document.body.innerHTML = "Invalid link";
  };
}
