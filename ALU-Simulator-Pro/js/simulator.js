(function (global) {
  'use strict';

  var ALULab = (global.ALULab = global.ALULab || {});

  var SPEEDS = {
    '0.5': 1600,
    '1': 950,
    '2': 480,
    '4': 240
  };

  var state = {
    status: 'IDLE', // IDLE | LOADED | RUNNING | PAUSED | COMPLETED | RESERVED_HALT
    operandA: '00001101', // 13
    operandB: '00000111', // 7
    opcode: '000',
    execution: null,
    currentStep: -1,
    speed: '1',
    timerId: null,
    listeners: []
  };

  function subscribe(fn) {
    if (typeof fn === 'function') {
      state.listeners.push(fn);
    }
  }

  function notify(eventType) {
    var snapshot = getSnapshot();
    for (var i = 0; i < state.listeners.length; i++) {
      state.listeners[i](snapshot, eventType || 'STATE_CHANGE');
    }
  }

  function clearTimer() {
    if (state.timerId !== null) {
      global.clearTimeout(state.timerId);
      state.timerId = null;
    }
  }

  function setInputs(operandA, operandB, opcode) {
    if (typeof operandA === 'string') state.operandA = operandA;
    if (typeof operandB === 'string') state.operandB = operandB;
    if (typeof opcode === 'string') state.opcode = opcode;
  }

  function loadOperands(operandA, operandB, opcode) {
    clearTimer();
    setInputs(operandA, operandB, opcode);
    var exec = ALULab.ALU.execute(state.operandA, state.operandB, state.opcode);
    if (!exec.ok) {
      state.execution = null;
      state.currentStep = -1;
      state.status = 'IDLE';
      notify('ERROR');
      return exec;
    }
    state.execution = exec;
    state.currentStep = 0; // Etapa 1: Carga de registros
    state.status = 'LOADED';
    notify('LOADED');
    return exec;
  }

  function scheduleNextTick() {
    clearTimer();
    if (state.status !== 'RUNNING' || !state.execution) return;
    var delay = SPEEDS[state.speed] || 950;
    state.timerId = global.setTimeout(function () {
      if (state.status !== 'RUNNING') return;
      var maxStep = state.execution.trace.length - 1;
      if (state.currentStep < maxStep) {
        state.currentStep += 1;
        if (state.currentStep >= maxStep) {
          finishExecution();
        } else {
          notify('STEP');
          scheduleNextTick();
        }
      } else {
        finishExecution();
      }
    }, delay);
  }

  function finishExecution() {
    clearTimer();
    if (!state.execution) return;
    state.status = state.execution.isReserved ? 'RESERVED_HALT' : 'COMPLETED';
    notify('COMPLETED');
  }

  function run(operandA, operandB, opcode) {
    var exec = loadOperands(operandA || state.operandA, operandB || state.operandB, opcode || state.opcode);
    if (!exec.ok) return exec;
    state.status = 'RUNNING';
    notify('RUNNING');
    scheduleNextTick();
    return exec;
  }

  function executeImmediate(operandA, operandB, opcode) {
    clearTimer();
    setInputs(operandA || state.operandA, operandB || state.operandB, opcode || state.opcode);
    var exec = ALULab.ALU.execute(state.operandA, state.operandB, state.opcode);
    if (!exec.ok) return exec;
    state.execution = exec;
    state.currentStep = exec.trace.length - 1;
    state.status = exec.isReserved ? 'RESERVED_HALT' : 'COMPLETED';
    notify('COMPLETED');
    return exec;
  }

  function pause() {
    if (state.status !== 'RUNNING') return;
    clearTimer();
    state.status = 'PAUSED';
    notify('PAUSED');
  }

  function resume() {
    if (state.status !== 'PAUSED' || !state.execution) return;
    var maxStep = state.execution.trace.length - 1;
    if (state.currentStep >= maxStep) {
      finishExecution();
      return;
    }
    state.status = 'RUNNING';
    notify('RUNNING');
    scheduleNextTick();
  }

  function nextStep() {
    clearTimer();
    if (!state.execution) {
      var loaded = loadOperands(state.operandA, state.operandB, state.opcode);
      if (!loaded.ok) return;
      state.status = 'PAUSED';
      notify('STEP');
      return;
    }
    var maxStep = state.execution.trace.length - 1;
    if (state.currentStep < maxStep) {
      state.currentStep += 1;
      if (state.currentStep >= maxStep) {
        finishExecution();
      } else {
        state.status = 'PAUSED';
        notify('STEP');
      }
    }
  }

  function prevStep() {
    clearTimer();
    if (!state.execution) return;
    if (state.currentStep > 0) {
      state.currentStep -= 1;
      state.status = 'PAUSED';
      notify('STEP');
    }
  }

  function reset() {
    clearTimer();
    state.execution = null;
    state.currentStep = -1;
    state.status = 'IDLE';
    notify('RESET');
  }

  function setSpeed(speedKey) {
    if (SPEEDS[speedKey]) {
      state.speed = speedKey;
      if (state.status === 'RUNNING') {
        scheduleNextTick();
      }
      notify('SPEED');
    }
  }

  function getSnapshot() {
    var traceItem = null;
    if (state.execution && state.currentStep >= 0 && state.execution.trace[state.currentStep]) {
      traceItem = state.execution.trace[state.currentStep];
    }
    return {
      status: state.status,
      operandA: state.operandA,
      operandB: state.operandB,
      opcode: state.opcode,
      execution: state.execution,
      currentStep: state.currentStep,
      totalSteps: state.execution ? state.execution.trace.length : 5,
      traceItem: traceItem,
      speed: state.speed
    };
  }

  ALULab.Simulator = {
    subscribe: subscribe,
    setInputs: setInputs,
    loadOperands: loadOperands,
    run: run,
    executeImmediate: executeImmediate,
    pause: pause,
    resume: resume,
    nextStep: nextStep,
    prevStep: prevStep,
    reset: reset,
    setSpeed: setSpeed,
    getSnapshot: getSnapshot
  };
})(window);
