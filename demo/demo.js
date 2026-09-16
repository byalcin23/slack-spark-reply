"use strict";
window.SlackSparkDemo = async (type, payload) => {
  if (type === "spark:health") return {mode: "demo"};
  await new Promise(resolve => setTimeout(resolve, 400));
  return {
    mode: "demo",
    summary_tr: "Demo örneği: Alex, rehbere eklenen bağlantı için teşekkür ediyor ve sonraki yeni başlayanların daha kolay ilerlemesini umuyor.",
    note_tr: "Bu açıklama ve cevaplar, sentetik demo konuşması için önceden yazıldı. Yazdığın ek notlar burada gerçek bir modelle işlenmez.",
    replies: [
      {style: "short", text: "Glad it helps! Hopefully it makes things easier for the next person 🙂"},
      {style: "friendly", text: "Thanks, Alex! Still finding my way around, so it’s nice to make a small improvement already 😄"},
      {style: "professional", text: "Thanks for the feedback! Hopefully the direct link makes the access request process clearer for future newcomers."}
    ]
  };
};
