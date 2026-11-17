(function (global) {
  'use strict';

  var ALULab = (global.ALULab = global.ALULab || {});
  var STORAGE_KEY = 'alu_simulator_pro_history_v1';
  var MAX_ITEMS = 60;

  var entries = loadFromStorage();

  function loadFromStorage() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveToStorage() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // Silencio seguro si localStorage está bloqueado
    }
  }

  function recordExecution(exec) {
    if (!exec || !exec.ok) return null;

    var item = {
      id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
      opcode: exec.opcode,
      mnemonic: exec.operation.mnemonic,
      isReserved: exec.isReserved,
      aBin: exec.operandA.binary,
      aUnsigned: exec.operandA.unsigned,
      aSigned: exec.operandA.signed,
      bBin: exec.operandB.binary,
      bUnsigned: exec.operandB.unsigned,
      bSigned: exec.operandB.signed,
      rBin: exec.result ? exec.result.binary : 'RESERVADO',
      rUnsigned: exec.result ? exec.result.unsigned : null,
      rSigned: exec.result ? exec.result.signed : null,
      flags: {
        Z: exec.flags.Z,
        C: exec.flags.C,
        N: exec.flags.N,
        V: exec.flags.V
      }
    };

    entries.unshift(item);
    if (entries.length > MAX_ITEMS) {
      entries.length = MAX_ITEMS;
    }
    saveToStorage();
    return item;
  }

  function clearHistory() {
    entries = [];
    saveToStorage();
  }

  function getEntries() {
    return entries.slice();
  }

  function renderHistoryTable(container, onReplay) {
    if (!container) return;

    if (entries.length === 0) {
      container.innerHTML = '<p class="panel-meta">No hay operaciones registradas todavía. Ejecuta una operación en el simulador para guardarla en el historial local.</p>';
      return;
    }

    var rows = entries.map(function (item) {
      var flagsText = item.isReserved
        ? '—'
        : ('Z=' + item.flags.Z + ' C=' + item.flags.C + ' N=' + item.flags.N + ' V=' + item.flags.V);
      var resText = item.isReserved
        ? '<span class="status-text-warn">Reservado</span>'
        : '<span class="mono">' + item.rBin + '</span> <span class="panel-meta">(' + item.rUnsigned + ' / ' + item.rSigned + ')</span>';

      return [
        '<tr>',
        '  <td class="mono">' + item.timestamp + '</td>',
        '  <td class="mono">' + item.opcode + ' · ' + item.mnemonic + '</td>',
        '  <td class="mono">' + item.aBin + ' <span class="panel-meta">(' + item.aUnsigned + ')</span></td>',
        '  <td class="mono">' + item.bBin + ' <span class="panel-meta">(' + item.bUnsigned + ')</span></td>',
        '  <td>' + resText + '</td>',
        '  <td class="mono">' + flagsText + '</td>',
        '  <td><button type="button" class="btn btn-sm" data-replay-id="' + item.id + '">Re-ejecutar</button></td>',
        '</tr>'
      ].join('');
    }).join('');

    container.innerHTML = [
      '<div class="table-wrap">',
      '  <table class="lab-table">',
      '    <thead>',
      '      <tr>',
      '        <th>Hora</th>',
      '        <th>Control</th>',
      '        <th>Operando A</th>',
      '        <th>Operando B</th>',
      '        <th>Resultado</th>',
      '        <th>Banderas (Z C N V)</th>',
      '        <th>Acción</th>',
      '      </tr>',
      '    </thead>',
      '    <tbody>' + rows + '</tbody>',
      '  </table>',
      '</div>'
    ].join('\n');

    var buttons = container.querySelectorAll('[data-replay-id]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        var id = this.getAttribute('data-replay-id');
        var found = entries.find(function (e) { return e.id === id; });
        if (found && typeof onReplay === 'function') {
          onReplay(found);
        }
      });
    }
  }

  ALULab.History = {
    recordExecution: recordExecution,
    clearHistory: clearHistory,
    getEntries: getEntries,
    renderHistoryTable: renderHistoryTable
  };
})(window);
