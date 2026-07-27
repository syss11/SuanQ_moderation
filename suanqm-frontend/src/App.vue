<script setup lang="ts">
import { useUserStore } from './stores/user'
import MainLayout from './layouts/MainLayout.vue'

const userStore = useUserStore()
</script>

<template>
  <MainLayout v-if="userStore.isAuthenticated" />
  <router-view v-else />
</template>

<style scoped>
</style>
