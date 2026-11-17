(function (global) {
  'use strict';

  var ALULab = (global.ALULab = global.ALULab || {});

  var currentView = 'simulator';
  var inputState = {
    aValid: true,
    bValid: true,
    aBin: '00001101',
    bBin: '00000111',
    opcode: '000'
  };

  function init() {
    bindNavigation();
    bindOperandControls('A');
    bindOperandControls('B');
    bindOpcodeSelector();
    bindTransportControls();
    bindTestControls();
    bindHistoryControls();
    bindPresentationControls();

    // Suscribirse al motor de simulación paso a paso
    ALULab.Simulator.subscribe(function (snapshot, eventType) {
      renderDashboardAndPanels(snapshot);
      if (eventType === 'COMPLETED' && snapshot.execution && snapshot.execution.ok) {
        ALULab.History.recordExecution(snapshot.execution);
        if (currentView === 'history') {
          refreshHistoryView();
        }
      }
    });

    // Render inicial con valores por defecto (13 + 7 = 20)
    syncOperandUI('A', inputState.aBin);
    syncOperandUI('B', inputState.bBin);
    renderBitSwitches('A');
    renderBitSwitches('B');
    updateOpcodeButtons();
    ALULab.Simulator.executeImmediate(inputState.aBin, inputState.bBin, inputState.opcode);
  }

  /* ========================================================================
     Navegación entre módulos
     ======================================================================== */
  function bindNavigation() {
    var tabs = document.querySelectorAll('[data-view-target]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        var target = this.getAttribute('data-view-target');
        switchView(target);
      });
    }
  }

  function switchView(viewName) {
    currentView = viewName;
    var panels = document.querySelectorAll('.view-panel');
    for (var i = 0; i < panels.length; i++) {
      panels[i].classList.toggle('is-active', panels[i].id === 'view-' + viewName);
    }

    var tabs = document.querySelectorAll('[data-view-target]');
    for (var j = 0; j < tabs.length; j++) {
      tabs[j].classList.toggle('is-active', tabs[j].getAttribute('data-view-target') === viewName);
    }

    var snap = ALULab.Simulator.getSnapshot();
    if (viewName === 'circuits') {
      refreshCircuitsView(snap);
    } else if (viewName === 'education') {
      ALULab.Education.renderEducationView(document.getElementById('educationContainer'), snap);
    } else if (viewName === 'history') {
      refreshHistoryView();
    } else if (viewName === 'presentation') {
      ALULab.Presentation.updatePresentationReadout(snap);
    }
  }

  /* ========================================================================
     Controles de Operandos (8 bits manuales, interruptores y decimal)
     ======================================================================== */
  function bindOperandControls(which) {
    var binInput = document.getElementById('inputBin' + which);
    var decInput = document.getElementById('inputDec' + which);

    if (binInput) {
      binInput.addEventListener('input', function () {
        var res = ALULab.Binary.validateBinary8(this.value);
        setValidationState(which, res.valid, res.error || '');
        if (res.valid) {
          if (which === 'A') inputState.aBin = res.value;
          else inputState.bBin = res.value;

          var bits = ALULab.Binary.stringToBits(res.value);
          var u = ALULab.Binary.bitsToUnsigned(bits);
          var s = ALULab.Binary.bitsToSigned(bits);
          if (decInput) decInput.value = String(u);
          updateOperandSummary(which, bits, u, s);
          renderBitSwitches(which);
          onValidInputChanged();
        }
      });
    }

    if (decInput) {
      decInput.addEventListener('input', function () {
        var res = ALULab.Binary.validateDecimal8(this.value, 'any');
        setValidationState(which, res.valid, res.error || '');
        if (res.valid) {
          var bits = ALULab.Binary.decimalToBits(res.value);
          var binStr = ALULab.Binary.bitsToString(bits);
          if (which === 'A') inputState.aBin = binStr;
          else inputState.bBin = binStr;

          if (binInput) binInput.value = binStr;
          updateOperandSummary(which, bits, res.unsigned, res.signed);
          renderBitSwitches(which);
          onValidInputChanged();
        }
      });
    }
  }

  function syncOperandUI(which, binStr) {
    var binInput = document.getElementById('inputBin' + which);
    var decInput = document.getElementById('inputDec' + which);
    var bits = ALULab.Binary.stringToBits(binStr);
    var u = ALULab.Binary.bitsToUnsigned(bits);
    var s = ALULab.Binary.bitsToSigned(bits);

    if (binInput) binInput.value = binStr;
    if (decInput) decInput.value = String(u);
    setValidationState(which, true, '');
    updateOperandSummary(which, bits, u, s);
  }

  function updateOperandSummary(which, bits, unsignedVal, signedVal) {
    var el = document.getElementById('readoutOp' + which);
    if (el) {
      el.textContent = 'Sin signo: ' + unsignedVal + ' · Con signo: ' + signedVal + ' · ' + ALULab.Binary.bitsToHex(bits);
    }
  }

  function setValidationState(which, isValid, errorMsg) {
    if (which === 'A') inputState.aValid = isValid;
    else inputState.bValid = isValid;

    var binInput = document.getElementById('inputBin' + which);
    var decInput = document.getElementById('inputDec' + which);
    var msgEl = document.getElementById('errorOp' + which);

    if (binInput) binInput.classList.toggle('is-invalid', !isValid);
    if (decInput) decInput.classList.toggle('is-invalid', !isValid);
    if (msgEl) {
      msgEl.textContent = errorMsg;
      msgEl.classList.toggle('is-visible', !isValid);
    }
  }

  function renderBitSwitches(which) {
    var container = document.getElementById('switchesOp' + which);
    if (!container) return;

    var binStr = which === 'A' ? inputState.aBin : inputState.bBin;
    var bits = ALULab.Binary.stringToBits(binStr);
    container.innerHTML = '';

    for (var i = 7; i >= 0; i--) {
      (function (bitIdx) {
        var val = bits[bitIdx];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bit-switch' + (val === 1 ? ' is-one' : '');
        btn.setAttribute('aria-pressed', val === 1 ? 'true' : 'false');
        btn.setAttribute('aria-label', 'Operando ' + which + ' bit ' + bitIdx);
        btn.innerHTML = '<span class="bit-switch-index">b' + bitIdx + '</span><span class="bit-switch-val">' + val + '</span>';
        btn.addEventListener('click', function () {
          var currentBits = ALULab.Binary.stringToBits(which === 'A' ? inputState.aBin : inputState.bBin);
          currentBits[bitIdx] = currentBits[bitIdx] === 1 ? 0 : 1;
          var nextBin = ALULab.Binary.bitsToString(currentBits);
          if (which === 'A') inputState.aBin = nextBin;
          else inputState.bBin = nextBin;
          syncOperandUI(which, nextBin);
          renderBitSwitches(which);
          onValidInputChanged();
        });
        container.appendChild(btn);
      })(i);
    }
  }

  function onValidInputChanged() {
    if (!inputState.aValid || !inputState.bValid) return;
    ALULab.Simulator.setInputs(inputState.aBin, inputState.bBin, inputState.opcode);
  }

  /* ========================================================================
     Unidad de Control (3 bits)
     ======================================================================== */
  function bindOpcodeSelector() {
    var btns = document.querySelectorAll('[data-opcode]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        inputState.opcode = this.getAttribute('data-opcode');
        updateOpcodeButtons();
        onValidInputChanged();
      });
    }
  }

  function updateOpcodeButtons() {
    var btns = document.querySelectorAll('[data-opcode]');
    for (var i = 0; i < btns.length; i++) {
      var code = btns[i].getAttribute('data-opcode');
      btns[i].classList.toggle('is-active', code === inputState.opcode);
    }
  }

  /* ========================================================================
     Botones de simulación paso a paso
     ======================================================================== */
  function bindTransportControls() {
    var btnLoad = document.getElementById('btnLoadOperands');
    var btnRun = document.getElementById('btnRunSim');
    var btnInstant = document.getElementById('btnRunInstant');
    var btnPause = document.getElementById('btnPauseSim');
    var btnResume = document.getElementById('btnResumeSim');
    var btnNext = document.getElementById('btnNextStep');
    var btnPrev = document.getElementById('btnPrevStep');
    var btnReset = document.getElementById('btnResetSim');

    if (btnLoad) {
      btnLoad.addEventListener('click', function () {
        if (!ensureValidInputs()) return;
        ALULab.Simulator.loadOperands(inputState.aBin, inputState.bBin, inputState.opcode);
      });
    }
    if (btnRun) {
      btnRun.addEventListener('click', function () {
        if (!ensureValidInputs()) return;
        ALULab.Simulator.run(inputState.aBin, inputState.bBin, inputState.opcode);
      });
    }
    if (btnInstant) {
      btnInstant.addEventListener('click', function () {
        if (!ensureValidInputs()) return;
        ALULab.Simulator.executeImmediate(inputState.aBin, inputState.bBin, inputState.opcode);
      });
    }
    if (btnPause) btnPause.addEventListener('click', ALULab.Simulator.pause);
    if (btnResume) btnResume.addEventListener('click', ALULab.Simulator.resume);
    if (btnNext) {
      btnNext.addEventListener('click', function () {
        if (!ensureValidInputs()) return;
        ALULab.Simulator.setInputs(inputState.aBin, inputState.bBin, inputState.opcode);
        ALULab.Simulator.nextStep();
      });
    }
    if (btnPrev) btnPrev.addEventListener('click', ALULab.Simulator.prevStep);
    if (btnReset) btnReset.addEventListener('click', ALULab.Simulator.reset);

    var speedBtns = document.querySelectorAll('[data-speed]');
    for (var i = 0; i < speedBtns.length; i++) {
      speedBtns[i].addEventListener('click', function () {
        var spd = this.getAttribute('data-speed');
        ALULab.Simulator.setSpeed(spd);
        updateSpeedButtons(spd);
      });
    }
  }

  function updateSpeedButtons(activeSpeed) {
    var speedBtns = document.querySelectorAll('[data-speed]');
    for (var i = 0; i < speedBtns.length; i++) {
      speedBtns[i].classList.toggle('is-active', speedBtns[i].getAttribute('data-speed') === activeSpeed);
    }
  }

  function ensureValidInputs() {
    return inputState.aValid && inputState.bValid;
  }

  /* ========================================================================
     Actualización de Dashboard, SVG, Timeline y Banderas
     ======================================================================== */
  function renderDashboardAndPanels(snapshot) {
    var exec = snapshot.execution;
    var opMeta = ALULab.ALU.OPCODE_TABLE[snapshot.opcode] || ALULab.ALU.OPCODE_TABLE['000'];

    // KPI Dashboard
    var kpiOpA = document.getElementById('kpiOpA');
    var kpiOpASub = document.getElementById('kpiOpASub');
    var kpiOpB = document.getElementById('kpiOpB');
    var kpiOpBSub = document.getElementById('kpiOpBSub');
    var kpiControl = document.getElementById('kpiControl');
    var kpiControlSub = document.getElementById('kpiControlSub');
    var kpiResult = document.getElementById('kpiResult');
    var kpiResultSub = document.getElementById('kpiResultSub');
    var kpiStatus = document.getElementById('kpiStatus');
    var kpiStatusSub = document.getElementById('kpiStatusSub');

    var bitsA = ALULab.Binary.stringToBits(snapshot.operandA);
    var bitsB = ALULab.Binary.stringToBits(snapshot.operandB);

    if (kpiOpA) kpiOpA.textContent = snapshot.operandA;
    if (kpiOpASub) kpiOpASub.textContent = ALULab.Binary.bitsToUnsigned(bitsA) + ' sin signo · ' + ALULab.Binary.bitsToSigned(bitsA) + ' con signo';
    if (kpiOpB) kpiOpB.textContent = snapshot.operandB;
    if (kpiOpBSub) kpiOpBSub.textContent = ALULab.Binary.bitsToUnsigned(bitsB) + ' sin signo · ' + ALULab.Binary.bitsToSigned(bitsB) + ' con signo';

    if (kpiControl) kpiControl.textContent = snapshot.opcode + ' · ' + opMeta.mnemonic;
    if (kpiControlSub) kpiControlSub.textContent = opMeta.name;

    var showResult = exec && !exec.isReserved && (snapshot.status === 'COMPLETED' || (snapshot.traceItem && snapshot.traceItem.stepIndex >= 3));
    if (kpiResult) {
      kpiResult.textContent = exec && exec.isReserved ? 'RESERVADO' : (showResult ? exec.result.binary : '--------');
    }
    if (kpiResultSub) {
      if (exec && exec.isReserved) {
        kpiResultSub.textContent = 'Código ' + exec.opcode + ' sin operación';
      } else if (showResult) {
        kpiResultSub.textContent = exec.result.unsigned + ' sin signo · ' + exec.result.signed + ' con signo · ' + exec.result.hex;
      } else {
        kpiResultSub.textContent = 'Esperando ciclo del Multiplexor';
      }
    }

    var statusLabels = {
      IDLE: 'En espera',
      LOADED: 'Operandos cargados',
      RUNNING: 'Ejecutando pasos',
      PAUSED: 'Pausado',
      COMPLETED: 'Completado',
      RESERVED_HALT: 'Detenido (Reservado)'
    };
    if (kpiStatus) kpiStatus.textContent = statusLabels[snapshot.status] || snapshot.status;
    if (kpiStatusSub) {
      kpiStatusSub.textContent = snapshot.currentStep >= 0
        ? 'Paso ' + (snapshot.currentStep + 1) + ' de ' + snapshot.totalSteps
        : 'Listo para iniciar';
    }

    // Barra de bits del resultado
    renderResultBitsBar(showResult ? exec.result.bits : null);

    // Registro de banderas (LEDs)
    var showFlags = exec && !exec.isReserved && (snapshot.status === 'COMPLETED' || (snapshot.traceItem && snapshot.traceItem.stepIndex >= 4));
    updateFlagLEDs(showFlags ? exec.flags : { Z: 0, C: 0, N: 0, V: 0 }, opMeta.mnemonic, showFlags);

    // Timeline paso a paso
    renderStepTimeline(snapshot);

    // Botones habilitar/deshabilitar
    updateTransportButtonStates(snapshot);

    // Diagrama SVG principal
    var mainDiagram = document.getElementById('mainArchitectureDiagram');
    if (mainDiagram) {
      var handleSelectComponent = function (compId) {
        ALULab.Circuits.setSelectedComponentId(compId);
        renderQuickInspector(compId, snapshot);
        ALULab.Circuits.buildArchitectureSVG(mainDiagram, snapshot, handleSelectComponent);
      };
      ALULab.Circuits.buildArchitectureSVG(mainDiagram, snapshot, handleSelectComponent);
    }

    renderQuickInspector(ALULab.Circuits.getSelectedComponentId(), snapshot);

    if (currentView === 'circuits') {
      refreshCircuitsView(snapshot);
    } else if (currentView === 'education') {
      ALULab.Education.renderEducationView(document.getElementById('educationContainer'), snapshot);
    } else if (currentView === 'presentation') {
      ALULab.Presentation.updatePresentationReadout(snapshot);
    }
  }

  function renderResultBitsBar(bits) {
    var el = document.getElementById('resultBitsBar');
    if (!el) return;
    el.innerHTML = '';
    for (var i = 7; i >= 0; i--) {
      var val = bits ? bits[i] : '-';
      var cell = document.createElement('div');
      cell.className = 'result-bit-cell' + (val === 1 ? ' is-one' : '');
      cell.innerHTML = '<div style="font-size:0.625rem;color:var(--text-dim);">R' + i + '</div><div style="font-size:1rem;font-weight:700;">' + val + '</div>';
      el.appendChild(cell);
    }
  }

  function updateFlagLEDs(flags, mnemonic, isValidState) {
    var map = [
      { id: 'Z', label: 'Zero' },
      { id: 'C', label: mnemonic === 'SUB' ? 'Carry / Borrow' : 'Carry' },
      { id: 'N', label: 'Negative' },
      { id: 'V', label: 'Overflow' }
    ];

    for (var i = 0; i < map.length; i++) {
      var f = map[i];
      var cell = document.getElementById('flagCell' + f.id);
      var stateText = document.getElementById('flagState' + f.id);
      var isOn = isValidState && flags[f.id] === 1;
      if (cell) {
        cell.classList.toggle('is-on', isOn);
      }
      if (stateText) {
        if (!isValidState) {
          stateText.textContent = '0 · Inactiva';
        } else if (f.id === 'C' && mnemonic === 'SUB' && isOn) {
          stateText.textContent = '1 · Préstamo (A < B)';
        } else {
          stateText.textContent = isOn ? '1 · Activa' : '0 · Inactiva';
        }
      }
    }
  }

  function renderStepTimeline(snapshot) {
    var timelineEl = document.getElementById('stepTimeline');
    var bannerEl = document.getElementById('traceBanner');

    var defaultSteps = [
      '1. Carga de registros',
      '2. Decodificación',
      '3. Unidades ALU',
      '4. Multiplexor 4:1',
      '5. Resultado y banderas'
    ];

    if (timelineEl) {
      timelineEl.innerHTML = '';
      var trace = snapshot.execution ? snapshot.execution.trace : null;
      var count = trace ? trace.length : defaultSteps.length;
      for (var i = 0; i < count; i++) {
        var title = trace ? trace[i].title : defaultSteps[i];
        var cls = 'step-node';
        if (snapshot.currentStep > i || (snapshot.status === 'COMPLETED' && i <= snapshot.currentStep)) {
          cls += ' is-done';
        }
        if (snapshot.currentStep === i && snapshot.status !== 'IDLE') {
          cls += ' is-current';
        }
        var node = document.createElement('div');
        node.className = cls;
        node.innerHTML = '<span class="step-num">Etapa ' + (i + 1) + '</span><span class="step-label">' + title.replace(/^\d+\.\s*/, '') + '</span>';
        timelineEl.appendChild(node);
      }
    }

    if (bannerEl) {
      bannerEl.textContent = snapshot.traceItem
        ? snapshot.traceItem.summary
        : 'Carga los operandos o presiona Ejecutar para observar el recorrido real de las señales en la ALU.';
    }
  }

  function updateTransportButtonStates(snapshot) {
    var btnPause = document.getElementById('btnPauseSim');
    var btnResume = document.getElementById('btnResumeSim');
    var btnPrev = document.getElementById('btnPrevStep');

    if (btnPause) btnPause.disabled = snapshot.status !== 'RUNNING';
    if (btnResume) btnResume.disabled = snapshot.status !== 'PAUSED';
    if (btnPrev) btnPrev.disabled = snapshot.currentStep <= 0;
  }

  function renderQuickInspector(compId, snapshot) {
    var box = document.getElementById('quickComponentInspector');
    if (!box) return;
    var meta = ALULab.Circuits.COMPONENT_CATALOG.find(function (c) { return c.id === compId; });
    if (!meta) return;

    var exec = snapshot.execution || ALULab.ALU.execute(snapshot.operandA, snapshot.operandB, snapshot.opcode);
    var extra = '';
    if (exec && exec.ok) {
      if (compId === 'adderUnit') {
        extra = 'Suma = ' + ALULab.Binary.bitsToString(exec.units.add.bits) + ' · Cout = ' + exec.units.add.cOut;
      } else if (compId === 'subUnit') {
        extra = 'NOT(B) = ' + ALULab.Binary.bitsToString(exec.units.invertedB) + ' · Diferencia = ' + ALULab.Binary.bitsToString(exec.units.sub.bits);
      } else if (compId === 'andUnit') {
        extra = 'Salida = ' + ALULab.Binary.bitsToString(exec.units.and.bits);
      } else if (compId === 'orUnit') {
        extra = 'Salida = ' + ALULab.Binary.bitsToString(exec.units.or.bits);
      } else if (compId === 'muxUnit') {
        extra = 'Selector = ' + exec.opcode + ' (' + exec.operation.mnemonic + ')';
      } else if (compId === 'resultReg') {
        extra = exec.result ? 'Valor = ' + exec.result.binary + ' (' + exec.result.unsigned + ')' : 'Sin salida (código reservado)';
      } else if (compId === 'flagsReg') {
        extra = exec.isReserved ? 'Banderas inactivas' : 'Z=' + exec.flags.Z + ' C=' + exec.flags.C + ' N=' + exec.flags.N + ' V=' + exec.flags.V;
      } else if (compId === 'regA') {
        extra = 'Valor = ' + exec.operandA.binary + ' (' + exec.operandA.unsigned + ' / ' + exec.operandA.signed + ')';
      } else if (compId === 'regB') {
        extra = 'Valor = ' + exec.operandB.binary + ' (' + exec.operandB.unsigned + ' / ' + exec.operandB.signed + ')';
      } else if (compId === 'controlUnit') {
        extra = 'Código = ' + exec.opcode + ' · ' + exec.operation.name;
      }
    }

    box.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">' +
      '  <div><strong>' + meta.name + '</strong> — <span class="panel-meta">' + meta.role + '</span></div>' +
      '  <div class="mono" style="color:var(--accent-cyan-bright);font-size:0.875rem;">' + extra + '</div>' +
      '</div>';
  }

  function refreshCircuitsView(snapshot) {
    ALULab.Circuits.renderCircuitExplorer(
      document.getElementById('explorerComponentList'),
      document.getElementById('explorerComponentDetail'),
      document.getElementById('explorerBitTable'),
      snapshot
    );
  }

  /* ========================================================================
     Laboratorio de Pruebas (Unitarias + 262,144 Exhaustivas)
     ======================================================================== */
  function bindTestControls() {
    renderTestsTable();

    var btnRunAll = document.getElementById('btnRunAllTests');
    var btnExhaustive = document.getElementById('btnRunExhaustive');

    if (btnRunAll) {
      btnRunAll.addEventListener('click', function () {
        var summary = ALULab.Tests.runAllTests();
        renderTestsTable();
        var sumEl = document.getElementById('testsSummaryText');
        if (sumEl) {
          sumEl.textContent = 'Pruebas ejecutadas: ' + summary.passed + ' aprobadas de ' + summary.total + (summary.failed > 0 ? ' (' + summary.failed + ' fallidas).' : '. Todas verificadas contra oráculo independiente.');
        }
      });
    }

    if (btnExhaustive) {
      btnExhaustive.addEventListener('click', function () {
        if (ALULab.Tests.isExhaustiveRunning()) return;
        btnExhaustive.disabled = true;
        var fill = document.getElementById('exhaustiveProgressFill');
        var statusEl = document.getElementById('exhaustiveStatusText');

        ALULab.Tests.runExhaustiveVerification(
          function (prog) {
            var pct = ((prog.checked / prog.total) * 100).toFixed(1);
            if (fill) fill.style.width = pct + '%';
            if (statusEl) {
              statusEl.textContent = 'Verificando: ' + prog.checked.toLocaleString('es-ES') + ' / ' + prog.total.toLocaleString('es-ES') + ' combinaciones (' + pct + '%) · Fallos: ' + prog.failures;
            }
          },
          function (done) {
            btnExhaustive.disabled = false;
            if (fill) fill.style.width = '100%';
            if (statusEl) {
              if (done.failures === 0) {
                statusEl.innerHTML = '<span class="status-text-ok">VERIFICACIÓN COMPLETA: 262.144 / 262.144 combinaciones aprobadas sin discrepancias (' + done.elapsedMs + ' ms).</span>';
              } else {
                statusEl.innerHTML = '<span class="status-text-fail">Se encontraron ' + done.failures + ' fallos de 262.144 combinaciones.</span>';
              }
            }
          }
        );
      });
    }
  }

  function renderTestsTable() {
    var container = document.getElementById('testsTableContainer');
    if (!container) return;

    var cases = ALULab.Tests.TEST_CASES;
    var results = ALULab.Tests.getResults();

    var rows = cases.map(function (tc) {
      var res = results[tc.id];
      var statusHtml = '<span class="panel-meta">Sin ejecutar</span>';
      var obtained = '—';
      var expected = '—';

      if (res) {
        statusHtml = res.passed
          ? '<span class="status-text-ok">Aprobada</span>'
          : '<span class="status-text-fail">Fallida</span>';
        obtained = res.obtained;
        expected = res.expected;
      }

      return [
        '<tr>',
        '  <td class="mono">' + tc.id + '</td>',
        '  <td>' + tc.name + '</td>',
        '  <td>' + tc.category + '</td>',
        '  <td class="mono" style="font-size:0.8125rem;">' + expected + '</td>',
        '  <td class="mono" style="font-size:0.8125rem;">' + obtained + '</td>',
        '  <td>' + statusHtml + '</td>',
        '  <td><button type="button" class="btn btn-sm" data-run-test="' + tc.id + '">Probar</button></td>',
        '</tr>'
      ].join('');
    }).join('');

    container.innerHTML = [
      '<div class="table-wrap">',
      '  <table class="lab-table">',
      '    <thead>',
      '      <tr>',
      '        <th>ID</th>',
      '        <th>Caso de prueba</th>',
      '        <th>Categoría</th>',
      '        <th>Esperado (Oráculo)</th>',
      '        <th>Obtenido (ALU)</th>',
      '        <th>Estado</th>',
      '        <th>Acción</th>',
      '      </tr>',
      '    </thead>',
      '    <tbody>' + rows + '</tbody>',
      '  </table>',
      '</div>'
    ].join('\n');

    var btns = container.querySelectorAll('[data-run-test]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var id = this.getAttribute('data-run-test');
        ALULab.Tests.runSingleTest(id);
        renderTestsTable();
      });
    }
  }

  /* ========================================================================
     Historial
     ======================================================================== */
  function bindHistoryControls() {
    var btnClear = document.getElementById('btnClearHistory');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        ALULab.History.clearHistory();
        refreshHistoryView();
      });
    }
  }

  function refreshHistoryView() {
    ALULab.History.renderHistoryTable(document.getElementById('historyTableContainer'), function (entry) {
      inputState.aBin = entry.aBin;
      inputState.bBin = entry.bBin;
      inputState.opcode = entry.opcode;
      syncOperandUI('A', entry.aBin);
      syncOperandUI('B', entry.bBin);
      renderBitSwitches('A');
      renderBitSwitches('B');
      updateOpcodeButtons();
      switchView('simulator');
      ALULab.Simulator.run(entry.aBin, entry.bBin, entry.opcode);
    });
  }

  /* ========================================================================
     Modo Presentación
     ======================================================================== */
  function bindPresentationControls() {
    var presetsEl = document.getElementById('presentationPresets');
    if (presetsEl) {
      ALULab.Presentation.renderPresentationPresets(presetsEl, function (preset) {
        inputState.aBin = preset.a;
        inputState.bBin = preset.b;
        inputState.opcode = preset.opcode;
        syncOperandUI('A', preset.a);
        syncOperandUI('B', preset.b);
        renderBitSwitches('A');
        renderBitSwitches('B');
        updateOpcodeButtons();
        ALULab.Simulator.run(preset.a, preset.b, preset.opcode);
      });
    }

    var btnPresRun = document.getElementById('btnPresRun');
    var btnPresNext = document.getElementById('btnPresNext');
    var btnPresPrev = document.getElementById('btnPresPrev');
    var btnPresReset = document.getElementById('btnPresReset');

    if (btnPresRun) {
      btnPresRun.addEventListener('click', function () {
        ALULab.Simulator.run(inputState.aBin, inputState.bBin, inputState.opcode);
      });
    }
    if (btnPresNext) btnPresNext.addEventListener('click', ALULab.Simulator.nextStep);
    if (btnPresPrev) btnPresPrev.addEventListener('click', ALULab.Simulator.prevStep);
    if (btnPresReset) btnPresReset.addEventListener('click', ALULab.Simulator.reset);
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
