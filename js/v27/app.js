import { seedPostcards } from "./data.js";
import { toUIData } from "./adapter.js";
import { renderGallery } from "./ui/gallery.js";
import { initModal, openModal } from "./ui/modal.js";
import { initControls } from "./ui/controls.js";
import { renderModeLists } from "./ui/modes.js";
import { copyCoords, openGoogleMap } from "./ui/actions.js";
import { showToast } from "./ui/toast.js";

let cards = toUIData(seedPostcards);
let filteredCards = [...cards];

const galleryEl = document.querySelector("#postcardGallery");

function rerender(){
  renderGallery(filteredCards, galleryEl, {
    onOpen(index){
      const originalIndex = cards.findIndex(card => card.id === filteredCards[index].id);
      openModal(originalIndex);
    },

    onCopy(card){
      copyCoords(card.coords);
    },

    onMap(card){
      openGoogleMap(card.coords);
    },

    onWant(index){
      const id = filteredCards[index].id;
      const original = cards.find(card => card.id === id);

      if (original) {
        original.want += 1;
      }

      applyCurrentFilter();
    }
  });

  renderModeLists(filteredCards);
}

function applyFilter({ keyword = "", region = "all" } = {}){
  filteredCards = cards.filter(card => {
    const matchRegion = region === "all" || card.country === region;
    const searchable = `${card.no} ${card.country} ${card.coords} ${card.uploader}`.toLowerCase();
    const matchKeyword = !keyword || searchable.includes(keyword.toLowerCase());

    return matchRegion && matchKeyword;
  });

  rerender();
}

let lastFilter = { keyword: "", region: "all" };

function applyCurrentFilter(){
  applyFilter(lastFilter);
}

function handleUpload(file){
  const reader = new FileReader();

  reader.onload = () => {
    cards.unshift({
      id: `postcard-${Date.now()}`,
      no: `No.${String(cards.length + 1).padStart(3, "0")}`,
      image: reader.result,
      country: "待補",
      coords: "待補座標",
      want: 0,
      type: "公開明信片",
      uploader: "你"
    });

    showToast("已匯入圖片");
    applyCurrentFilter();
  };

  reader.readAsDataURL(file);
}

initModal(cards, {
  onWantChange(){
    applyCurrentFilter();
  }
});

initControls({
  onUpload: handleUpload,

  onCreateCoords(payload){
    cards.unshift({
      id: `postcard-${Date.now()}`,
      no: payload.note || `No.${String(cards.length + 1).padStart(3, "0")}`,
      image: "./assets/images/postcard-sample.png",
      country: payload.country,
      coords: payload.coords,
      want: 0,
      type: "座標卡片",
      uploader: "你"
    });

    showToast("已建立座標卡片");
    applyCurrentFilter();
  },

  onValidationError(message){
    showToast(message);
  },

  onFilter(filter){
    lastFilter = filter;
    applyFilter(filter);
  },

  onModeChange(mode){
    const labelMap = {
      collection: "收藏冊",
      map: "地圖模式",
      collage: "拼貼模式",
      preview: "預覽模式"
    };

    showToast(`已切換到：${labelMap[mode] || mode}`);
  }
});

rerender();
