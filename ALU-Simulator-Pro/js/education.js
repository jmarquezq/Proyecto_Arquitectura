(function (global) {
  'use strict';

  var ALULab = (global.ALULab = global.ALULab || {});

  var ASSEMBLY_GUIDE = {
    '000': {
      title: 'ADD — Suma binaria de 8 bits',
      formula: 'R = A + B   (8 sumadores completos en cascada, Cin = 0)',
      explanation: 'Cada etapa calcula Si = Ai ⊕ Bi ⊕ Ci y propaga el acarreo Ci+1 = (Ai · Bi) + (Ci · (Ai ⊕ Bi)). Si el bit 7 genera acarreo, la bandera C = 1. Si los operandos tienen el mismo signo y el resultado cambia de signo, V = 1.',
      asm: [
        'x86 (8 bits):   ADD AL, BL        ; AL ← AL + BL, actualiza ZF, CF, SF, OF',
        'ARM:            ADDS R0, R1, R2   ; R0 ← R1 + R2 con actualización de banderas',
        'MIPS:           ADD $t0, $t1, $t2 ; Suma con signo (ADDU sin excepción)'
      ],
      truthTitle: 'Tabla de verdad — Sumador Completo (Full Adder 1 bit)',
      truthHeaders: ['A', 'B', 'Cin', 'Sum (S)', 'Cout'],
      truthRows: [
        ['0', '0', '0', '0', '0'],
        ['0', '0', '1', '1', '0'],
        ['0', '1', '0', '1', '0'],
        ['0', '1', '1', '0', '1'],
        ['1', '0', '0', '1', '0'],
        ['1', '0', '1', '0', '1'],
        ['1', '1', '0', '0', '1'],
        ['1', '1', '1', '1', '1']
      ]
    },
    '001': {
      title: 'SUB — Resta mediante Complemento a Dos',
      formula: 'A − B = A + NOT(B) + 1',
      explanation: 'El hardware reutiliza el sumador de 8 bits invirtiendo B bit a bit (complemento a 1) e inyectando Cin = 1. Bajo la convención de préstamo (Borrow), C = 1 indica que A < B sin signo (equivalente a Cout_sumador = 0).',
      asm: [
        'x86 (8 bits):   SUB AL, BL        ; AL ← AL - BL, CF=1 si AL < BL (Borrow)',
        'ARM:            SUBS R0, R1, R2   ; R0 ← R1 - R2 (en ARM C = NOT Borrow)',
        'MIPS:           SUB $t0, $t1, $t2 ; Resta aritmética de registros'
      ],
      truthTitle: 'Tabla de verdad — Inversor (NOT B) + Inyección Cin = 1',
      truthHeaders: ['Bi', 'NOT(Bi)', 'Efecto en A + NOT(B) + 1'],
      truthRows: [
        ['0', '1', 'Se suma 1 al bit i en la etapa del sumador'],
        ['1', '0', 'Se suma 0 al bit i; el +1 inicial completa −B']
      ]
    },
    '010': {
      title: 'AND — Conjunción lógica bit a bit',
      formula: 'Ri = Ai · Bi   (C = 0, V = 0)',
      explanation: 'Evalúa simultáneamente 8 compuertas AND independientes sin propagación de acarreo. Se emplea habitualmente como máscara para aislar o limpiar bits específicos de un registro.',
      asm: [
        'x86 (8 bits):   AND AL, BL        ; AL ← AL & BL, limpia CF=0 y OF=0',
        'ARM:            ANDS R0, R1, R2   ; R0 ← R1 & R2, actualiza Z y N',
        'MIPS:           AND $t0, $t1, $t2 ; Conjunción bit a bit'
      ],
      truthTitle: 'Tabla de verdad — Compuerta AND (2 entradas)',
      truthHeaders: ['Ai', 'Bi', 'Ai AND Bi'],
      truthRows: [
        ['0', '0', '0'],
        ['0', '1', '0'],
        ['1', '0', '0'],
        ['1', '1', '1']
      ]
    },
    '011': {
      title: 'OR — Disyunción lógica bit a bit',
      formula: 'Ri = Ai + Bi   (C = 0, V = 0)',
      explanation: 'Evalúa simultáneamente 8 compuertas OR independientes. Se utiliza para activar (poner en 1) bits específicos de un byte de control o puerto de E/S sin alterar los demás bits.',
      asm: [
        'x86 (8 bits):   OR AL, BL         ; AL ← AL | BL, limpia CF=0 y OF=0',
        'ARM:            ORRS R0, R1, R2   ; R0 ← R1 | R2, actualiza Z y N',
        'MIPS:           OR $t0, $t1, $t2  ; Disyunción bit a bit'
      ],
      truthTitle: 'Tabla de verdad — Compuerta OR (2 entradas)',
      truthHeaders: ['Ai', 'Bi', 'Ai OR Bi'],
      truthRows: [
        ['0', '0', '0'],
        ['0', '1', '1'],
        ['1', '0', '1'],
        ['1', '1', '1']
      ]
    }
  };

  function renderEducationView(container, snapshot) {
    if (!container) return;

    var opcode = snapshot && ASSEMBLY_GUIDE[snapshot.opcode] ? snapshot.opcode : '000';
    var guide = ASSEMBLY_GUIDE[opcode];
    var exec = snapshot && snapshot.execution
      ? snapshot.execution
      : ALULab.ALU.execute(snapshot.operandA, snapshot.operandB, opcode);

    var calcBlock = buildLiveCalculationText(exec, opcode);

    var tableRows = guide.truthRows.map(function (row) {
      return '<tr>' + row.map(function (cell) {
        return '<td class="mono">' + cell + '</td>';
      }).join('') + '</tr>';
    }).join('');

    var tableHeaders = guide.truthHeaders.map(function (h) {
      return '<th>' + h + '</th>';
    }).join('');

    container.innerHTML = [
      '<div class="two-col-grid">',
      '  <section class="panel">',
      '    <div class="panel-header">',
      '      <div>',
      '        <h3 class="panel-title">' + guide.title + '</h3>',
      '        <p class="panel-meta mono" style="color:var(--accent-cyan-bright);margin-top:4px;">' + guide.formula + '</p>',
      '      </div>',
      '    </div>',
      '    <p style="color:var(--text-secondary);margin-bottom:16px;">' + guide.explanation + '</p>',
      '    <h4 style="font-size:0.9375rem;margin-bottom:8px;">Cálculo binario paso a paso (operandos actuales)</h4>',
      '    <div class="code-block" style="margin-bottom:16px;">' + calcBlock + '</div>',
      '    <h4 style="font-size:0.9375rem;margin-bottom:8px;">Instrucciones equivalentes en Lenguaje Ensamblador</h4>',
      '    <div class="code-block">' + guide.asm.join('\n') + '</div>',
      '  </section>',

      '  <section class="panel">',
      '    <div class="panel-header">',
      '      <h3 class="panel-title">' + guide.truthTitle + '</h3>',
      '    </div>',
      '    <div class="table-wrap" style="margin-bottom:20px;">',
      '      <table class="lab-table">',
      '        <thead><tr>' + tableHeaders + '</tr></thead>',
      '        <tbody>' + tableRows + '</tbody>',
      '      </table>',
      '    </div>',
      '    <h4 style="font-size:0.9375rem;margin-bottom:8px;">Tabla de selección del Multiplexor 4:1</h4>',
      '    <div class="table-wrap">',
      '      <table class="lab-table">',
      '        <thead><tr><th>Código (S2 S1 S0)</th><th>Operación</th><th>Canal MUX</th><th>Estado</th></tr></thead>',
      '        <tbody>',
      '          <tr><td class="mono">000</td><td>ADD (Suma)</td><td>Canal 0</td><td class="status-text-ok">Activa</td></tr>',
      '          <tr><td class="mono">001</td><td>SUB (Resta)</td><td>Canal 1</td><td class="status-text-ok">Activa</td></tr>',
      '          <tr><td class="mono">010</td><td>AND (Lógica)</td><td>Canal 2</td><td class="status-text-ok">Activa</td></tr>',
      '          <tr><td class="mono">011</td><td>OR (Lógica)</td><td>Canal 3</td><td class="status-text-ok">Activa</td></tr>',
      '          <tr><td class="mono">100 – 111</td><td>Reservado</td><td>Bloqueado</td><td class="status-text-warn">Reservado</td></tr>',
      '        </tbody>',
      '      </table>',
      '    </div>',
      '  </section>',
      '</div>'
    ].join('\n');
  }

  function buildLiveCalculationText(exec, opcode) {
    if (!exec || !exec.ok) return 'Ingresa operandos válidos de 8 bits para generar la demostración.';
    if (exec.isReserved) return 'Código ' + exec.opcode + ' reservado: selecciona 000, 001, 010 o 011 para ver el cálculo binario.';

    var A = exec.operandA.binary;
    var B = exec.operandB.binary;
    var R = exec.result.binary;

    if (opcode === '000') {
      var carriesStr = exec.units.add.carries.slice(0, 8).reverse().join('');
      return [
        'Acarreos:   ' + carriesStr + '  (Cin0 = 0)',
        '  A:        ' + A + '  (' + exec.operandA.unsigned + ' sin signo | ' + exec.operandA.signed + ' con signo)',
        '+ B:        ' + B + '  (' + exec.operandB.unsigned + ' sin signo | ' + exec.operandB.signed + ' con signo)',
        '──────────────────────',
        '  R (8b):   ' + R + '  (' + exec.result.unsigned + ' sin signo | ' + exec.result.signed + ' con signo)',
        '  Cout = ' + exec.units.add.cOut + '  |  Z=' + exec.flags.Z + ' C=' + exec.flags.C + ' N=' + exec.flags.N + ' V=' + exec.flags.V
      ].join('\n');
    }

    if (opcode === '001') {
      var invB = ALULab.Binary.bitsToString(exec.units.invertedB);
      return [
        'Paso 1 (NOT B):     ' + invB,
        'Paso 2 (+ 1):       Se inyecta Cin0 = 1 al sumador de 8 bits',
        '  A:                ' + A + '  (' + exec.operandA.unsigned + ')',
        '+ NOT(B) + 1:       ' + invB + ' + 1',
        '──────────────────────────────',
        '  Diferencia (8b):  ' + R + '  (' + exec.result.unsigned + ' sin signo | ' + exec.result.signed + ' con signo)',
        '  Cout sumador = ' + exec.units.sub.cOut + '  ->  Préstamo (Borrow C) = ' + exec.flags.C
      ].join('\n');
    }

    var sym = opcode === '010' ? 'AND' : 'OR ';
    return [
      '  A:        ' + A,
      sym + ' B:      ' + B,
      '──────────────────────',
      '  R (8b):   ' + R + '  (Hex: ' + exec.result.hex + ')',
      '  Banderas: Z=' + exec.flags.Z + '  C=0  N=' + exec.flags.N + '  V=0'
    ].join('\n');
  }

  ALULab.Education = {
    renderEducationView: renderEducationView
  };
})(window);
