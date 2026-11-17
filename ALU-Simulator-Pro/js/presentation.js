(function (global) {
  'use strict';

  var ALULab = (global.ALULab = global.ALULab || {});

  var DEMO_PRESETS = [
    {
      id: 'demo-add-normal',
      title: '1. Suma estándar (13 + 7 = 20)',
      desc: 'Flujo limpio a través de 8 sumadores completos sin acarreo ni desbordamiento.',
      a: '00001101',
      b: '00000111',
      opcode: '000'
    },
    {
      id: 'demo-add-carry',
      title: '2. Suma con Acarreo de salida (200 + 100)',
      desc: 'Supera los 255 bits sin signo (300 mod 256 = 44), activando C = 1.',
      a: '11001000',
      b: '01100100',
      opcode: '000'
    },
    {
      id: 'demo-add-overflow',
      title: '3. Desbordamiento con signo (127 + 1 = -128)',
      desc: 'Dos positivos producen bit de signo negativo: C=0 pero V=1 y N=1.',
      a: '01111111',
      b: '00000001',
      opcode: '000'
    },
    {
      id: 'demo-sub-borrow',
      title: '4. Resta por Complemento a 2 con Préstamo (15 − 25)',
      desc: 'Ejecuta A + NOT(B) + 1; al ser A < B sin signo, activa C = 1 (Borrow) y N = 1.',
      a: '00001111',
      b: '00011001',
      opcode: '001'
    },
    {
      id: 'demo-and-mask',
      title: '5. Máscara de nibble inferior con AND',
      desc: 'Aísla los 4 bits bajos de 10110110 usando la máscara 00001111 (C=0, V=0).',
      a: '10110110',
      b: '00001111',
      opcode: '010'
    },
    {
      id: 'demo-or-set',
      title: '6. Activación de bits con OR',
      desc: 'Combina banderas de registro 10100000 OR 00000101 = 10100101.',
      a: '10100000',
      b: '00000101',
      opcode: '011'
    }
  ];

  var activePresetId = 'demo-add-normal';

  function renderPresentationPresets(container, onSelectPreset) {
    if (!container) return;
    container.innerHTML = '';

    for (var i = 0; i < DEMO_PRESETS.length; i++) {
      (function (preset) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset-card' + (preset.id === activePresetId ? ' is-active' : '');
        btn.innerHTML = '<span class="preset-title">' + preset.title + '</span><span class="preset-desc">' + preset.desc + '</span>';
        btn.addEventListener('click', function () {
          activePresetId = preset.id;
          renderPresentationPresets(container, onSelectPreset);
          if (typeof onSelectPreset === 'function') {
            onSelectPreset(preset);
          }
        });
        container.appendChild(btn);
      })(DEMO_PRESETS[i]);
    }
  }

  function updatePresentationReadout(snapshot) {
    var diagramEl = document.getElementById('presentationDiagram');
    var summaryEl = document.getElementById('presentationSummary');
    var readoutEl = document.getElementById('presentationReadout');

    if (diagramEl) {
      ALULab.Circuits.buildArchitectureSVG(diagramEl, snapshot);
    }

    if (summaryEl) {
      summaryEl.textContent = snapshot.traceItem
        ? snapshot.traceItem.summary
        : 'Selecciona una demostración precargada y presiona Ejecutar o Siguiente paso para exponer el flujo de datos.';
    }

    if (readoutEl) {
      var exec = snapshot.execution;
      if (!exec || !exec.ok) {
        readoutEl.textContent = 'Estado en espera';
      } else if (exec.isReserved) {
        readoutEl.textContent = 'Control ' + exec.opcode + ' · Código reservado (sin salida)';
      } else {
        readoutEl.textContent =
          'A=' + exec.operandA.binary + ' (' + exec.operandA.signed + ')  ' +
          exec.operation.mnemonic + '  ' +
          'B=' + exec.operandB.binary + ' (' + exec.operandB.signed + ')  →  ' +
          'R=' + exec.result.binary + ' (' + exec.result.unsigned + ' sin signo / ' + exec.result.signed + ' con signo)  |  ' +
          'Z=' + exec.flags.Z + ' C=' + exec.flags.C + ' N=' + exec.flags.N + ' V=' + exec.flags.V;
      }
    }
  }

  ALULab.Presentation = {
    DEMO_PRESETS: DEMO_PRESETS,
    renderPresentationPresets: renderPresentationPresets,
    updatePresentationReadout: updatePresentationReadout
  };
})(window);
