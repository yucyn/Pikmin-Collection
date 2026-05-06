(function(){
  function $(id){ return document.getElementById(id); }

  document.addEventListener("DOMContentLoaded", function(){
    const fab = $("v28CreateFab");
    const menu = $("v28CreateMenu");
    const fileInput = $("fileInput");
    const collageBtn = $("collageViewBtn");
    const coordDialog = $("v28CoordDialog");
    const coordClose = $("v28CoordClose");
    const coordApply = $("v28CoordApply");
    const coordValue = $("v28CoordValue");
    const coordCountry = $("v28CoordCountry");
    const locationInput = $("locationInput");
    const categoryInput = $("categoryInput");

    if(!fab || !menu) return;

    function openMenu(){
      menu.classList.add("show");
      menu.setAttribute("aria-hidden","false");
      fab.classList.add("open");
    }

    function closeMenu(){
      menu.classList.remove("show");
      menu.setAttribute("aria-hidden","true");
      fab.classList.remove("open");
    }

    function toggleMenu(){
      menu.classList.contains("show") ? closeMenu() : openMenu();
    }

    function openCoordDialog(){
      coordDialog.classList.add("show");
      coordDialog.setAttribute("aria-hidden","false");
      setTimeout(function(){ coordValue && coordValue.focus(); }, 60);
    }

    function closeCoordDialog(){
      coordDialog.classList.remove("show");
      coordDialog.setAttribute("aria-hidden","true");
    }

    fab.addEventListener("click", function(e){
      e.stopPropagation();
      toggleMenu();
    });

    menu.addEventListener("click", function(e){
      const item = e.target.closest("[data-v28-action]");
      if(!item) return;

      const action = item.getAttribute("data-v28-action");
      closeMenu();

      if(action === "upload"){
        if(fileInput) fileInput.click();
        return;
      }

      if(action === "collage"){
        if(collageBtn) collageBtn.click();
        return;
      }

      if(action === "coords"){
        openCoordDialog();
      }
    });

    document.addEventListener("click", function(e){
      if(!menu.contains(e.target) && e.target !== fab) closeMenu();
    });

    if(coordClose) coordClose.addEventListener("click", closeCoordDialog);

    if(coordDialog){
      coordDialog.addEventListener("click", function(e){
        if(e.target === coordDialog) closeCoordDialog();
      });
    }

    if(coordApply){
      coordApply.addEventListener("click", function(){
        const coords = coordValue.value.trim();
        const country = coordCountry.value.trim();

        if(!coords){
          window.PikminV28Toast && window.PikminV28Toast("請先輸入座標");
          return;
        }

        if(locationInput) {
          locationInput.value = coords;
          locationInput.dispatchEvent(new Event("input"));
          locationInput.dispatchEvent(new Event("change"));
          locationInput.dispatchEvent(new Event("blur"));
        }
        if(categoryInput && country) {
          categoryInput.value = country;
          categoryInput.dispatchEvent(new Event("input"));
          categoryInput.dispatchEvent(new Event("change"));
        }

        window.PikminV28Toast && window.PikminV28Toast("已填入左側表單");
        closeCoordDialog();
      });
    }
  });
})();
