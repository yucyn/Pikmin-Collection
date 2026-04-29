export function toUIData(rawItems){
  return rawItems.map((item, index) => ({
    id: item.id || `postcard-${index + 1}`,
    no: item.no || `No.${String(index + 1).padStart(3, "0")}`,
    image: item.image || item.imageUrl || item.img,
    coords: item.coords || `${item.lat || ""}, ${item.lng || ""}`,
    country: item.country || "未知",
    want: Number(item.want || item.wantCount || item.likes || 0),
    type: item.type || "公開明信片",
    uploader: item.uploader || "匿名玩家"
  }));
}
