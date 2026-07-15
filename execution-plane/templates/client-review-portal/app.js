const reviewButton = document.querySelector('#reviewButton');
const reviewPanel = document.querySelector('#reviewPanel');

reviewButton?.addEventListener('click', () => {
  if (!reviewPanel) return;
  reviewPanel.hidden = !reviewPanel.hidden;
  reviewButton.textContent = reviewPanel.hidden ? 'Open review' : 'Close review';
});
