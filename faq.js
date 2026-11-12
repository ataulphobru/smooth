const search = document.querySelector('[data-faq-search]');
const empty = document.querySelector('[data-faq-empty]');
const count = document.querySelector('[data-faq-count]');
const clear = document.querySelector('[data-faq-clear]');
const groups = Array.from(document.querySelectorAll('[data-faq-group]'));

if (search && empty && count && clear && groups.length) {
  const normalize = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
  const entries = Array.from(document.querySelectorAll('[data-faq-item]'), (element) => ({
    element,
    text: normalize([element.textContent, element.dataset.faqAlias].filter(Boolean).join(' '))
  }));

  const filter = () => {
    const words = normalize(search.value).trim().split(/\s+/).filter(Boolean);
    let matches = 0;
    for (const { element, text } of entries) {
      element.hidden = !words.every((word) => text.includes(word));
      if (!element.hidden) matches += 1;
    }
    for (const group of groups) {
      group.hidden = !group.querySelector('[data-faq-item]:not([hidden])');
    }
    empty.hidden = matches > 0;
    clear.hidden = words.length === 0;
    const message = matches === 1 ? '1 pergunta encontrada.' : `${matches} perguntas encontradas.`;
    count.textContent = !words.length
      ? ''
      : matches ? message : 'Nenhuma pergunta encontrada.';
  };

  search.addEventListener('input', filter);
  clear.addEventListener('click', () => {
    search.value = '';
    filter();
    search.focus();
  });
  window.addEventListener('pageshow', filter);
  document.querySelectorAll('[data-faq-controls]').forEach((control) => { control.hidden = false; });
  filter();
}
