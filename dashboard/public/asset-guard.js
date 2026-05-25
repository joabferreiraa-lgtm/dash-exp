(() => {
  setTimeout(() => {
    const cssLoaded = getComputedStyle(document.body).fontFamily.toLowerCase().includes("arial");
    const jsLoaded = !document.querySelector("#statusPill") || document.querySelector("#statusPill").textContent !== "Carregando";
    const alreadyRetried = sessionStorage.getItem("assetGuardRetried") === "1";

    if ((!cssLoaded || !jsLoaded) && !alreadyRetried) {
      sessionStorage.setItem("assetGuardRetried", "1");
      location.reload();
      return;
    }

    if (cssLoaded && jsLoaded) {
      sessionStorage.removeItem("assetGuardRetried");
    }
  }, 5000);
})();
