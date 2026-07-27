<template>
  <div class="about">
    <h1>SuanQ Moderation 机器人群聊管理系统</h1>
    <p>这是一个基于 前端 Vue 3 和 TypeScript / 后端 Typescript 的机器人群聊管理系统</p>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped lang="scss">
@use "../styles/variables.scss" as *;

.about {
  padding: 20px;

  h1 {
    color: $color-secondary;
    font-size: 2rem;
  }

  p {
    color: $color-text-secondary;
    font-size: 1.1rem;
  }
}
</style>
