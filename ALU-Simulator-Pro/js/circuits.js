(function (global) {
  'use strict';

  var ALULab = (global.ALULab = global.ALULab || {});

  var COMPONENT_CATALOG = [
    {
      id: 'regA',
      name: 'Registro A (8 bits)',
      role: 'Almacena el primer operando de entrada (A7..A0) antes de enviarlo al bus interno de la ALU.'
    },
    {
      id: 'regB',
      name: 'Registro B (8 bits)',
      role: 'Almacena el segundo operando (B7..B0) y alimenta al sumador, inversor y compuertas lógicas.'
    },
    {
      id: 'controlUnit',
      name: 'Unidad de Control (3 bits)',
      role: 'Decodifica los bits de control S2 S1 S0 (000–011 activas, 100–111 reservadas) y gobierna al Multiplexor.'
    },
    {
      id: 'adderUnit',
      name: 'Sumador de 8 bits (8 Full Adders)',
      role: 'Ejecuta A + B propagando el acarreo desde el bit 0 (Cin = 0) hasta el bit 7 (Cout).'
    },
    {
      id: 'subUnit',
      name: 'Circuito de Resta (Complemento a 2)',
      role: 'Invierte los 8 bits de B (NOT B) e inyecta Cin = 1 en el sumador de 8 bits: A - B = A + NOT(B) + 1.'
    },
    {
      id: 'andUnit',
      name: 'Compuertas AND (x8)',
      role: 'Ocho compuertas AND en paralelo que calculan Ri = Ai · Bi bit a bit.'
    },
    {
      id: 'orUnit',
      name: 'Compuertas OR (x8)',
      role: 'Ocho compuertas OR en paralelo que calculan Ri = Ai + Bi bit a bit.'
    },
    {
      id: 'muxUnit',
      name: 'Multiplexor 4:1 (8 bits)',
      role: 'Selecciona una de las cuatro rutas funcionales (ADD, SUB, AND, OR) según el código de control.'
    },
    {
      id: 'resultReg',
      name: 'Registro de Resultado (8 bits)',
      role: 'Captura los 8 bits finales entregados por el multiplexor conservando exactamente el ancho de palabra.'
    },
    {
      id: 'flagsReg',
      name: 'Registro de Banderas (Z, C, N, V)',
      role: 'Evalúa el resultado y los acarreos finales para actualizar Zero, Carry/Borrow, Negative y Overflow.'
    }
  ];

  var selectedComponentId = 'adderUnit';

  function getSelectedComponentId() {
    return selectedComponentId;
  }

  function setSelectedComponentId(id) {
    selectedComponentId = id;
  }

  /**
   * Construye el SVG interactivo completo de la arquitectura interna de la ALU.
   * Puede renderizarse en múltiples contenedores (Simulador principal y Modo Presentación).
   */
  function buildArchitectureSVG(container, snapshot, onSelectComponent) {
    if (!container) return;

    var exec = snapshot && snapshot.execution ? snapshot.execution : null;
    var trace = snapshot && snapshot.traceItem ? snapshot.traceItem : null;
    var activeNodes = trace ? trace.activeNodes : [];
    var activeWires = trace ? trace.activeWires : [];
    var isCompleted = snapshot && (snapshot.status === 'COMPLETED');
    var isError = trace && trace.isError;

    var valA = exec ? exec.operandA.binary : (snapshot ? snapshot.operandA : '00001101');
    var valB = exec ? exec.operandB.binary : (snapshot ? snapshot.operandB : '00000111');
    var opcode = snapshot ? snapshot.opcode : '000';
    var opMeta = ALULab.ALU.OPCODE_TABLE[opcode] || ALULab.ALU.OPCODE_TABLE['000'];

    var showResult = exec && !exec.isReserved && (isCompleted || (trace && trace.stepIndex >= 3));
    var showFlags = exec && !exec.isReserved && (isCompleted || (trace && trace.stepIndex >= 4));
    var valRes = showResult ? exec.result.binary : (exec && exec.isReserved ? 'RESERVADO' : '--------');
    var valFlags = showFlags
      ? ('Z:' + exec.flags.Z + ' C:' + exec.flags.C + ' N:' + exec.flags.N + ' V:' + exec.flags.V)
      : 'Z:- C:- N:- V:-';

    var Binary = ALULab.Binary;
    var addStr = exec ? Binary.bitsToString(exec.units.add.bits) : '--------';
    var subStr = exec ? Binary.bitsToString(exec.units.sub.bits) : '--------';
    var andStr = exec ? Binary.bitsToString(exec.units.and.bits) : '--------';
    var orStr = exec ? Binary.bitsToString(exec.units.or.bits) : '--------';

    function nodeCls(id) {
      var cls = 'svg-node-group';
      if (isCompleted && id !== 'controlUnit') {
        if (!exec || !exec.isReserved) {
          var op = opMeta.mnemonic;
          var usedUnits = { ADD: 'adderUnit', SUB: 'subUnit', AND: 'andUnit', OR: 'orUnit' };
          if (id === 'regA' || id === 'regB' || id === 'muxUnit' || id === 'resultReg' || id === 'flagsReg' || id === usedUnits[op]) {
            cls += ' is-active';
          }
        }
      } else if (activeNodes.indexOf(id) !== -1) {
        cls += isError ? ' is-error' : ' is-active';
      }
      if (selectedComponentId === id) {
        cls += ' is-selected';
      }
      return cls;
    }

    function wireCls(id, isCtrl) {
      var energized = false;
      if (isCompleted && exec && !exec.isReserved) {
        var op = opMeta.mnemonic;
        var map = {
          ADD: ['wireA_bus', 'wireB_bus', 'wireA_add', 'wireB_add', 'wireAdd_mux', 'wireCtrl_mux', 'wireMux_res', 'wireRes_flags'],
          SUB: ['wireA_bus', 'wireB_bus', 'wireA_sub', 'wireB_sub', 'wireSub_mux', 'wireCtrl_mux', 'wireMux_res', 'wireRes_flags'],
          AND: ['wireA_bus', 'wireB_bus', 'wireA_and', 'wireB_and', 'wireAnd_mux', 'wireCtrl_mux', 'wireMux_res', 'wireRes_flags'],
          OR: ['wireA_bus', 'wireB_bus', 'wireA_or', 'wireB_or', 'wireOr_mux', 'wireCtrl_mux', 'wireMux_res', 'wireRes_flags']
        };
        energized = map[op].indexOf(id) !== -1;
      } else {
        energized = activeWires.indexOf(id) !== -1;
      }
      if (!energized) return 'svg-wire';
      if (isError && id === 'wireCtrl_mux') return 'svg-wire is-warn-energized';
      var moving = snapshot && snapshot.status === 'RUNNING' ? ' is-flow-moving' : '';
      return 'svg-wire ' + (isCtrl ? 'is-control-energized' : 'is-energized') + moving;
    }

    container.innerHTML = [
      '<svg class="alu-svg" viewBox="0 0 920 500" role="img" aria-label="Diagrama interactivo de la arquitectura interna de la ALU de 8 bits">',
      '  <defs>',
      '    <marker id="arrowCyan" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">',
      '      <path d="M0,0 L7,3 L0,6 Z" fill="#22d3ee" />',
      '    </marker>',
      '    <marker id="arrowSlate" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">',
      '      <path d="M0,0 L7,3 L0,6 Z" fill="#64748b" />',
      '    </marker>',
      '  </defs>',

      // Bus lines from Reg A & Reg B to functional units
      '  <path class="' + wireCls('wireA_bus') + '" d="M 190 95 L 245 95 L 245 405" />',
      '  <path class="' + wireCls('wireB_bus') + '" d="M 190 215 L 265 215 L 265 425" />',

      // Branches to ADD (y=75), SUB (y=185), AND (y=295), OR (y=405)
      '  <path class="' + wireCls('wireA_add') + '" d="M 245 95 L 245 65 L 330 65" />',
      '  <path class="' + wireCls('wireB_add') + '" d="M 265 215 L 265 92 L 330 92" />',

      '  <path class="' + wireCls('wireA_sub') + '" d="M 245 170 L 330 170" />',
      '  <path class="' + wireCls('wireB_sub') + '" d="M 265 198 L 330 198" />',

      '  <path class="' + wireCls('wireA_and') + '" d="M 245 280 L 330 280" />',
      '  <path class="' + wireCls('wireB_and') + '" d="M 265 308 L 330 308" />',

      '  <path class="' + wireCls('wireA_or') + '" d="M 245 395 L 330 395" />',
      '  <path class="' + wireCls('wireB_or') + '" d="M 265 422 L 330 422" />',

      // Outputs from units to MUX
      '  <path class="' + wireCls('wireAdd_mux') + '" d="M 510 78 L 560 78 L 560 205 L 590 205" />',
      '  <path class="' + wireCls('wireSub_mux') + '" d="M 510 185 L 545 185 L 545 230 L 590 230" />',
      '  <path class="' + wireCls('wireAnd_mux') + '" d="M 510 295 L 545 295 L 545 255 L 590 255" />',
      '  <path class="' + wireCls('wireOr_mux') + '" d="M 510 408 L 560 408 L 560 280 L 590 280" />',

      // Control Unit to MUX
      '  <path class="' + wireCls('wireCtrl_mux', true) + '" d="M 190 365 L 220 365 L 220 468 L 635 468 L 635 322" />',

      // MUX -> Result -> Flags
      '  <path class="' + wireCls('wireMux_res') + '" d="M 680 242 L 735 242 L 735 165 L 755 165" />',
      '  <path class="' + wireCls('wireRes_flags') + '" d="M 825 215 L 825 275" />',

      // NODE: Registro A
      '  <g class="' + nodeCls('regA') + '" data-component="regA" tabindex="0">',
      '    <rect class="svg-node-box" x="24" y="52" width="166" height="84" rx="10" />',
      '    <text class="svg-label-title" x="38" y="76">Registro A (8 bits)</text>',
      '    <text class="svg-label-value" x="38" y="102">' + valA + '</text>',
      '    <text class="svg-label-sub" x="38" y="122">Dec: ' + (exec ? exec.operandA.unsigned + ' / ' + exec.operandA.signed : '--') + '</text>',
      '  </g>',

      // NODE: Registro B
      '  <g class="' + nodeCls('regB') + '" data-component="regB" tabindex="0">',
      '    <rect class="svg-node-box" x="24" y="172" width="166" height="84" rx="10" />',
      '    <text class="svg-label-title" x="38" y="196">Registro B (8 bits)</text>',
      '    <text class="svg-label-value" x="38" y="222">' + valB + '</text>',
      '    <text class="svg-label-sub" x="38" y="242">Dec: ' + (exec ? exec.operandB.unsigned + ' / ' + exec.operandB.signed : '--') + '</text>',
      '  </g>',

      // NODE: Unidad de Control
      '  <g class="' + nodeCls('controlUnit') + '" data-component="controlUnit" tabindex="0">',
      '    <rect class="svg-node-box" x="24" y="320" width="166" height="90" rx="10" />',
      '    <text class="svg-label-title" x="38" y="346">Unidad de Control</text>',
      '    <text class="svg-label-violet" x="38" y="372">Código: ' + opcode + ' · ' + opMeta.mnemonic + '</text>',
      '    <text class="svg-label-sub" x="38" y="394">' + (opMeta.reserved ? 'Código reservado' : opMeta.name) + '</text>',
      '  </g>',

      // NODE: Sumador 8 bits (000)
      '  <g class="' + nodeCls('adderUnit') + '" data-component="adderUnit" tabindex="0">',
      '    <rect class="svg-node-box" x="330" y="38" width="180" height="80" rx="10" />',
      '    <text class="svg-label-title" x="344" y="62">Sumador 8 bits (000)</text>',
      '    <text class="svg-label-value" x="344" y="86">' + addStr + '</text>',
      '    <text class="svg-label-sub" x="344" y="106">8× Full Adder · Cout=' + (exec ? exec.units.add.cOut : '-') + '</text>',
      '  </g>',

      // NODE: Circuito de Resta (001)
      '  <g class="' + nodeCls('subUnit') + '" data-component="subUnit" tabindex="0">',
      '    <rect class="svg-node-box" x="330" y="145" width="180" height="80" rx="10" />',
      '    <text class="svg-label-title" x="344" y="169">Circuito Resta (001)</text>',
      '    <text class="svg-label-value" x="344" y="193">' + subStr + '</text>',
      '    <text class="svg-label-sub" x="344" y="213">A + NOT(B) + 1 · Cout=' + (exec ? exec.units.sub.cOut : '-') + '</text>',
      '  </g>',

      // NODE: Compuertas AND (010)
      '  <g class="' + nodeCls('andUnit') + '" data-component="andUnit" tabindex="0">',
      '    <rect class="svg-node-box" x="330" y="255" width="180" height="80" rx="10" />',
      '    <text class="svg-label-title" x="344" y="279">Compuertas AND (010)</text>',
      '    <text class="svg-label-value" x="344" y="303">' + andStr + '</text>',
      '    <text class="svg-label-sub" x="344" y="323">8× Compuerta Ai · Bi</text>',
      '  </g>',

      // NODE: Compuertas OR (011)
      '  <g class="' + nodeCls('orUnit') + '" data-component="orUnit" tabindex="0">',
      '    <rect class="svg-node-box" x="330" y="368" width="180" height="80" rx="10" />',
      '    <text class="svg-label-title" x="344" y="392">Compuertas OR (011)</text>',
      '    <text class="svg-label-value" x="344" y="416">' + orStr + '</text>',
      '    <text class="svg-label-sub" x="344" y="436">8× Compuerta Ai + Bi</text>',
      '  </g>',

      // NODE: Multiplexor 4:1
      '  <g class="' + nodeCls('muxUnit') + '" data-component="muxUnit" tabindex="0">',
      '    <polygon class="svg-node-box" points="590,175 680,202 680,282 590,310" />',
      '    <text class="svg-label-title" x="604" y="232">MUX 4:1</text>',
      '    <text class="svg-label-violet" x="604" y="254">Sel: ' + opcode + '</text>',
      '    <text class="svg-label-sub" x="604" y="274">' + opMeta.mnemonic + '</text>',
      '  </g>',

      // NODE: Registro de Resultado
      '  <g class="' + nodeCls('resultReg') + '" data-component="resultReg" tabindex="0">',
      '    <rect class="svg-node-box" x="755" y="122" width="144" height="92" rx="10" />',
      '    <text class="svg-label-title" x="768" y="146">Resultado (8b)</text>',
      '    <text class="svg-label-value" x="768" y="174">' + valRes + '</text>',
      '    <text class="svg-label-sub" x="768" y="198">' + (showResult ? (exec.result.unsigned + ' / ' + exec.result.signed) : 'En espera') + '</text>',
      '  </g>',

      // NODE: Registro de Banderas
      '  <g class="' + nodeCls('flagsReg') + '" data-component="flagsReg" tabindex="0">',
      '    <rect class="svg-node-box" x="755" y="275" width="144" height="96" rx="10" />',
      '    <text class="svg-label-title" x="768" y="300">Banderas</text>',
      '    <text class="svg-label-value" x="768" y="328">' + valFlags + '</text>',
      '    <text class="svg-label-sub" x="768" y="352">Zero · Carry · Neg · V</text>',
      '  </g>',

      '</svg>'
    ].join('\n');

    var nodes = container.querySelectorAll('[data-component]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener('click', function () {
        var compId = this.getAttribute('data-component');
        selectedComponentId = compId;
        if (typeof onSelectComponent === 'function') {
          onSelectComponent(compId);
        }
      });
    }
  }

  /**
   * Renderiza el panel de inspección detallada y la tabla bit a bit para el Explorador de Circuitos.
   */
  function renderCircuitExplorer(listContainer, detailContainer, bitTableContainer, snapshot) {
    if (!listContainer || !detailContainer || !bitTableContainer) return;

    var exec = snapshot && snapshot.execution
      ? snapshot.execution
      : ALULab.ALU.execute(snapshot.operandA, snapshot.operandB, snapshot.opcode);

    // 1. Lista de componentes seleccionables
    listContainer.innerHTML = '';
    for (var i = 0; i < COMPONENT_CATALOG.length; i++) {
      (function (comp) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'component-item' + (comp.id === selectedComponentId ? ' is-selected' : '');
        btn.innerHTML = '<span>' + comp.name + '</span><span class="mono" style="color:var(--accent-cyan-bright);font-size:0.8rem;">Inspeccionar</span>';
        btn.addEventListener('click', function () {
          selectedComponentId = comp.id;
          renderCircuitExplorer(listContainer, detailContainer, bitTableContainer, snapshot);
        });
        listContainer.appendChild(btn);
      })(COMPONENT_CATALOG[i]);
    }

    // 2. Detalle del componente seleccionado con entradas y salidas reales
    var meta = COMPONENT_CATALOG.find(function (c) { return c.id === selectedComponentId; }) || COMPONENT_CATALOG[0];
    var ioLines = buildComponentIODetails(selectedComponentId, exec);

    detailContainer.innerHTML = [
      '<div class="panel-header">',
      '  <div>',
      '    <h3 class="panel-title">' + meta.name + '</h3>',
      '    <p class="panel-meta">' + meta.role + '</p>',
      '  </div>',
      '</div>',
      '<div class="code-block">' + ioLines + '</div>'
    ].join('\n');

    // 3. Tabla aritmética / lógica bit a bit (Bit 7 -> Bit 0)
    renderBitByBitTable(bitTableContainer, exec);
  }

  function buildComponentIODetails(compId, exec) {
    if (!exec || !exec.ok) return 'Sin datos válidos de entrada.';
    var Binary = ALULab.Binary;
    var u = exec.units;
    var A = exec.operandA.binary;
    var B = exec.operandB.binary;
    var invB = Binary.bitsToString(u.invertedB);

    switch (compId) {
      case 'regA':
        return 'Entrada:  ' + A + '\nSalida:   Bus interno A[7..0] = ' + A + '\nSin signo: ' + exec.operandA.unsigned + '  |  Con signo: ' + exec.operandA.signed + '  |  Hex: ' + exec.operandA.hex;
      case 'regB':
        return 'Entrada:  ' + B + '\nSalida:   Bus interno B[7..0] = ' + B + '\nSin signo: ' + exec.operandB.unsigned + '  |  Con signo: ' + exec.operandB.signed + '  |  Hex: ' + exec.operandB.hex;
      case 'controlUnit':
        return 'Código S2S1S0: ' + exec.opcode + '\nOperación:     ' + exec.operation.mnemonic + ' — ' + exec.operation.name + '\nEstado:        ' + (exec.isReserved ? 'RESERVADO (ruta bloqueada)' : 'Habilitado hacia MUX 4:1');
      case 'adderUnit':
        return 'Entrada A:     ' + A + '\nEntrada B:     ' + B + '\nCin inicial:   0\nSuma (S7..S0): ' + Binary.bitsToString(u.add.bits) + '\nAcarreos C8..C0: ' + u.add.carries.slice().reverse().join(' ');
      case 'subUnit':
        return 'Entrada A:     ' + A + '\nEntrada B:     ' + B + '\nNOT(B):        ' + invB + '\nCin inicial:   1  (A - B = A + NOT(B) + 1)\nDiferencia:    ' + Binary.bitsToString(u.sub.bits) + '\nCout sumador:  ' + u.sub.cOut + '  ->  Bandera Préstamo (Borrow): ' + (u.sub.cOut === 0 ? 1 : 0);
      case 'andUnit':
        return 'Entrada A:     ' + A + '\nEntrada B:     ' + B + '\nSalida A AND B:' + Binary.bitsToString(u.and.bits) + '\nEcuación:      Ri = Ai · Bi (para i = 0..7)';
      case 'orUnit':
        return 'Entrada A:     ' + A + '\nEntrada B:     ' + B + '\nSalida A OR B: ' + Binary.bitsToString(u.or.bits) + '\nEcuación:      Ri = Ai + Bi (para i = 0..7)';
      case 'muxUnit':
        return 'Canal 000 (ADD): ' + Binary.bitsToString(u.add.bits) + '\nCanal 001 (SUB): ' + Binary.bitsToString(u.sub.bits) + '\nCanal 010 (AND): ' + Binary.bitsToString(u.and.bits) + '\nCanal 011 (OR):  ' + Binary.bitsToString(u.or.bits) + '\nSelector S2..S0: ' + exec.opcode + ' -> Salida: ' + (exec.result ? exec.result.binary : 'BLOQUEADA (RESERVADO)');
      case 'resultReg':
        return exec.result
          ? 'Bus MUX -> Reg: ' + exec.result.binary + '\nSin signo:      ' + exec.result.unsigned + '\nCon signo:      ' + exec.result.signed + '\nHexadecimal:    ' + exec.result.hex
          : 'Sin escritura (código de control reservado ' + exec.opcode + ').';
      case 'flagsReg':
        return exec.isReserved
          ? 'Banderas inalteradas por código reservado.'
          : 'Z (Zero):     ' + exec.flags.Z + '  — ' + exec.flags.details.Z +
            '\nC (Carry):    ' + exec.flags.C + '  — ' + exec.flags.details.C +
            '\nN (Negative): ' + exec.flags.N + '  — ' + exec.flags.details.N +
            '\nV (Overflow): ' + exec.flags.V + '  — ' + exec.flags.details.V;
      default:
        return '';
    }
  }

  function renderBitByBitTable(container, exec) {
    if (!exec || !exec.ok) {
      container.innerHTML = '<p class="panel-meta">Corrige los operandos para ver el detalle bit a bit.</p>';
      return;
    }

    var op = exec.operation.mnemonic;
    var isArith = op === 'ADD' || op === 'SUB' || exec.isReserved;
    var adder = op === 'SUB' ? exec.units.sub : exec.units.add;
    var invB = exec.units.invertedB;
    var andGates = exec.units.and.gates;
    var orGates = exec.units.or.gates;

    var rows = [];
    for (var i = 7; i >= 0; i--) {
      if (isArith) {
        var st = adder.stages[i];
        var origB = exec.operandB.bits[i];
        var effectiveB = op === 'SUB' ? invB[i] : origB;
        rows.push(
          '<tr>' +
          '<td class="mono">Bit ' + i + '</td>' +
          '<td class="mono">' + st.a + '</td>' +
          '<td class="mono">' + origB + (op === 'SUB' ? ' → NOT=' + effectiveB : '') + '</td>' +
          '<td class="mono">' + st.cin + '</td>' +
          '<td class="mono" style="color:var(--accent-cyan-bright);font-weight:700;">' + st.sum + '</td>' +
          '<td class="mono">' + st.cout + '</td>' +
          '</tr>'
        );
      } else {
        var gate = op === 'AND' ? andGates[i] : orGates[i];
        rows.push(
          '<tr>' +
          '<td class="mono">Bit ' + i + '</td>' +
          '<td class="mono">' + gate.a + '</td>' +
          '<td class="mono">' + gate.b + '</td>' +
          '<td class="mono">—</td>' +
          '<td class="mono" style="color:var(--accent-cyan-bright);font-weight:700;">' + gate.out + '</td>' +
          '<td class="mono">0</td>' +
          '</tr>'
        );
      }
    }

    container.innerHTML = [
      '<div class="table-wrap">',
      '  <table class="lab-table">',
      '    <thead>',
      '      <tr>',
      '        <th>Posición</th>',
      '        <th>Ai</th>',
      '        <th>Bi' + (op === 'SUB' ? ' (y NOT Bi)' : '') + '</th>',
      '        <th>Cin</th>',
      '        <th>Salida (Ri)</th>',
      '        <th>Cout</th>',
      '      </tr>',
      '    </thead>',
      '    <tbody>' + rows.join('') + '</tbody>',
      '  </table>',
      '</div>'
    ].join('\n');
  }

  ALULab.Circuits = {
    COMPONENT_CATALOG: COMPONENT_CATALOG,
    getSelectedComponentId: getSelectedComponentId,
    setSelectedComponentId: setSelectedComponentId,
    buildArchitectureSVG: buildArchitectureSVG,
    renderCircuitExplorer: renderCircuitExplorer
  };
})(window);
