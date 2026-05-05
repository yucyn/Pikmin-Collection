(function(){
  function toast(text){
    let el = document.getElementById("v28Toast");
    if(!el){
      el = document.createElement("div");
      el.id = "v28Toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add("show");
    setTimeout(function(){ el.classList.remove("show"); }, 1500);
  }

  window.PikminV28Toast = toast;

  document.addEventListener("DOMContentLoaded", function(){
    const grid = document.getElementById("grid");

    if(grid){
      grid.classList.add("v28-gallery");
    }

    // Keep original sidebar upload, but let V28 feel display-first.
    const main = document.querySelector(".main");
    if(main) main.classList.add("v28-main-ready");

    // If original app re-renders #grid, keep the V28 skin active.
    if(grid && "MutationObserver" in window){
      const observer = new MutationObserver(function(){
        grid.classList.add("v28-gallery");
      });
      observer.observe(grid, { childList:true, subtree:false });
    }
  });
})();
