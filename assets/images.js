const TEMPETEN_IMAGES = {
  logo: 'https://storage.tally.so/ef069882-756c-42f8-afc4-783a777fdefa/5BA65833-882A-44BE-9874-1D567FCBBEDA.png',
  hero: 'https://storage.tally.so/3a852e04-e0e0-4176-8a9b-f315aab74c75/IMG_5182.jpeg',
  classic: 'https://storage.tally.so/3a852e04-e0e0-4176-8a9b-f315aab74c75/IMG_5182.jpeg',
  fusion: 'https://storage.tally.so/3a852e04-e0e0-4176-8a9b-f315aab74c75/IMG_5182.jpeg',
  beans: 'https://storage.tally.so/3a852e04-e0e0-4176-8a9b-f315aab74c75/IMG_5182.jpeg',
  mini: 'https://storage.tally.so/3a852e04-e0e0-4176-8a9b-f315aab74c75/IMG_5182.jpeg'
};

Object.entries(TEMPETEN_IMAGES).forEach(([key, src]) => {
  document.querySelectorAll(`[data-img="${key}"]`).forEach((img) => {
    img.src = src;
    img.addEventListener('error', () => {
      img.removeAttribute('src');
      img.alt = `${img.alt || 'Tempeten'} (imej tidak dapat dimuatkan)`;
    }, { once: true });
  });
});
