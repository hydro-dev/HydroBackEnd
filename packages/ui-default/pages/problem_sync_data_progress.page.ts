import $ from 'jquery';
import { NamedPage } from 'vj/misc/Page';

export default new NamedPage('problem_sync_data_progress', async () => {
  const targetDomainId = $('#target').data('domain');
  const targetDocId = $('#target').data('docid');

  const { default: WebSocket } = await import('../components/socket');
  const sock = new WebSocket(`${UiContext.ws_prefix}problem/sync_data_progress_conn`);

  const current: Record<string, number> = {};

  sock.onmessage = (_, data) => {
    const {
      domainId, docId, taskId, filename, count, total,
    } = JSON.parse(data);
    if (domainId !== targetDomainId || docId !== Number(targetDocId)) return;
    if ($('#noJudgers').length) {
      $('#noJudgers').replaceWith(`
        <div id="judgersContainer"></div>  
      `);
    }
    current[taskId] = Math.max(current[taskId] || 0, count);
    if ($(`#judger-${taskId}`).length) {
      $(`#judger-${taskId}-progress`).css('width', `${current[taskId] / total * 100}%`);
      $(`#judger-${taskId}-filename`).text(`Sync done: ${filename} (${current[taskId] / total * 100}%)`);
    } else {
      $('#judgersContainer').append(`
        <div class="section" style="transform: none; opacity: 1;" id="judger-${taskId}">
          <div class="section__header"><h1 class="section__title">${taskId}</h1></div>
          <div class="section__body">
            <div style="width: 100%; margin-bottom: 4px;">
              <div id="judger-${taskId}-progress" style="background-color: #0ea5e9; width: ${current[taskId] / total * 100}%; height: 16px;"></div>
            </div>
            <p id="judger-${taskId}-filename">Sync done: ${filename} (${current[taskId] / total * 100}%)</p>
          </div>
        </div>  
      `);
    }
  };
});
