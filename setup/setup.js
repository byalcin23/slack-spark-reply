"use strict";
const setupStatus = document.querySelector("#status");
const pairingField = document.querySelector("#pairing");
const keyField = document.querySelector("#api-key");
const connectButton = document.querySelector("#connect");
const fragment = new URLSearchParams(location.hash.slice(1));
pairingField.value = fragment.get("token") || "";
history.replaceState(null, "", location.pathname);
fetch("/health").then(response => response.json()).then(data => {
  setupStatus.textContent = data.mode === "live" ? "Canlı bağlantı yapılandırılmış. Yeni anahtar girerek değiştirebilirsin." : "API bağlantısı henüz kurulmamış.";
}).catch(() => setupStatus.textContent = "Yerel yardımcıya ulaşılamadı. start.command dosyasını çalıştır.");
document.querySelector("#setup-form").addEventListener("submit", async event => {
  event.preventDefault();
  connectButton.disabled = true;
  setupStatus.classList.remove("error");
  setupStatus.textContent = "OpenAI’dan gerçek bir örnek cevap bekleniyor…";
  const sample = document.querySelector("#sample"); sample.hidden = true; sample.textContent = "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch("/configure", {method: "POST", credentials: "omit", redirect: "error", signal: controller.signal,
      headers: {"Content-Type": "application/json", "X-Spark-Token": pairingField.value.trim()},
      body: JSON.stringify({api_key: keyField.value.trim(), model: document.querySelector("#model").value.trim()})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Bağlantı kurulamadı.");
    keyField.value = "";
    setupStatus.textContent = "✓ OpenAI bağlantısı doğrulandı · " + data.model + "\nSlack’te yardımcı panelini kapatıp tekrar aç, ardından Cevap öner’e bas.";
    sample.textContent = "OpenAI’ın gerçek test cevabı:\n" + data.sample; sample.hidden = false;
  } catch (error) {
    setupStatus.classList.add("error");
    setupStatus.textContent = error.name === "AbortError" ? "Test zaman aşımına uğradı. Biraz sonra tekrar dene." : error.message;
  } finally { clearTimeout(timeout); connectButton.disabled = false; }
});
