const TEMPETEN_IMAGES = {
  logo: 'https://storage.tally.so/ef069882-756c-42f8-afc4-783a777fdefa/5BA65833-882A-44BE-9874-1D567FCBBEDA.png',
  hero: 'https://storage.tally.so/3a852e04-e0e0-4176-8a9b-f315aab74c75/IMG_5182.jpeg',
  classic: 'https://storage.tally.so/3a852e04-e0e0-4176-8a9b-f315aab74c75/IMG_5182.jpeg',
  fusion: 'https://storage.tally.so/3a852e04-e0e0-4176-8a9b-f315aab74c75/IMG_5182.jpeg',
  beans: 'https://storage.tally.so/3a852e04-e0e0-4176-8a9b-f315aab74c75/IMG_5182.jpeg',
  mini: 'https://storage.tally.so/3a852e04-e0e0-4176-8a9b-f315aab74c75/IMG_5182.jpeg'
};

window.TEMPETEN_SET_IMAGE = (key, source) => {
  document.querySelectorAll(`[data-img="${key}"]`).forEach((image) => {
    image.src = source;
  });
};

Object.entries(TEMPETEN_IMAGES).forEach(([key, source]) => {
  window.TEMPETEN_SET_IMAGE(key, source);
});

// Optimised WebP versions of the original supplied logo and product photos.
['img-logo.js', 'img-classic.js', 'img-fusion.js'].forEach((file) => {
  const script = document.createElement('script');
  script.src = `assets/${file}`;
  script.async = true;
  document.head.appendChild(script);
});

// app.js builds date values from local midnight using toISOString().
// Browsers in Malaysia are ahead of UTC, so normalise the option values back
// to the same calendar day shown in the Malay date label.
const batchSelect = document.getElementById('batchSelect');
if (batchSelect && new Date().getTimezoneOffset() < 0) {
  const normaliseBatchValues = () => {
    [...batchSelect.options].forEach((option) => {
      if (!option.value || option.dataset.calendarFixed === 'true') return;
      const date = new Date(`${option.value}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + 1);
      option.value = date.toISOString().slice(0, 10);
      option.dataset.calendarFixed = 'true';
    });
  };

  new MutationObserver(normaliseBatchValues).observe(batchSelect, { childList: true });
  normaliseBatchValues();
}
