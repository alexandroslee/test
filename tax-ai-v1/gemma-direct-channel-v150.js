(function(){
  if(window.__taxAiGemmaDirectFetch)return;
  // Loaded after the Gradio resilient adapter but before the QR-authority wrapper.
  // This preserves a path to the real Hugging Face queue for explicit visual
  // cross-checks, while the normal electronic-invoice flow can still finish
  // instantly from QR data without spending ZeroGPU time.
  window.__taxAiGemmaDirectFetch=window.fetch.bind(window);
  console.info('[TaxAI] V1.5.0 direct Gemma channel ready');
})();
