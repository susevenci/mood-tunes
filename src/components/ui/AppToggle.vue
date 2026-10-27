<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <button
    class="toggle"
    :class="{ on: modelValue }"
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="knob"></span>
  </button>
</template>

<style scoped>
.toggle {
  position: relative;
  width: 42px;
  height: 24px;
  padding: 2px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: rgba(148, 176, 255, 0.1);
  transition: all 0.2s ease;
}

.toggle.on {
  border-color: transparent;
  background: linear-gradient(120deg, var(--accent), var(--accent-2));
}

.toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.knob {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #dce7ff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}

.toggle.on .knob {
  transform: translateX(18px);
  background: #fff;
}
</style>
