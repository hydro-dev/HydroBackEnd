import { NamedPage } from 'vj/misc/Page';
import UserSelectAutoComplete from 'vj/components/autocomplete/UserSelectAutoComplete';
import ProblemSelectAutoComplete from 'vj/components/autocomplete/ProblemSelectAutoComplete';
import tpl from 'vj/utils/tpl';
import getAvaliableLangs from 'vj/utils/avaliableLangs';

const page = new NamedPage('record_main', async () => {
  const [{ default: SockJs }, { DiffDOM }] = await Promise.all([
    import('../components/socket'),
    import('diff-dom'),
  ]);

  const sock = new SockJs(UiContext.socketUrl);
  const dd = new DiffDOM();

  let firstLoad = true;
  sock.onopen = () => {
    if (firstLoad) sock.send(JSON.stringify({ rids: UiContext.rids }));
    firstLoad = false;
  };
  sock.onmessage = (message) => {
    const msg = JSON.parse(message.data);
    const $newTr = $(msg.html);
    const $oldTr = $(`.record_main__table tr[data-rid="${$newTr.attr('data-rid')}"]`);
    if ($oldTr.length) {
      $oldTr.trigger('vjContentRemove');
      dd.apply($oldTr[0], dd.diff($oldTr[0], $newTr[0]));
      $oldTr.trigger('vjContentNew');
    } else {
      $('.record_main__table tbody').prepend($newTr);
      $('.record_main__table tbody tr:last').remove();
      $newTr.trigger('vjContentNew');
    }
  };
  UserSelectAutoComplete.getOrConstruct($('[name="uidOrName"]'), {
    clearDefaultValue: false,
  });
  ProblemSelectAutoComplete.getOrConstruct($('[name="pid"]'), {
    clearDefaultValue: false,
  });
  const avaliableLangs = getAvaliableLangs(UiContext.domain.langs?.split(','));
  Object.keys(avaliableLangs).map(
    (i) => ($('select[name="lang"]').append(tpl`<option value="${i}" key="${i}">${avaliableLangs[i].display}</option>`)));
  const lang = new URL(window.location.href).searchParams.get('lang');
  if (lang) $('select[name="lang"]').val(lang);
  const status = new URL(window.location.href).searchParams.get('status');
  if (status) $('select[name="status"]').val(status);
});

export default page;
