<script lang="ts">
	import { messages } from '$lib/stores/messages.store.ts';
</script>

<main>
	<h1>P2P Console Viewer</h1>
	<section>
		{#each $messages as message}
			<div class="message {message.direction}">
				<div>{message.timestamp}</div>
				<div>{message.content}</div>
			</div>
		{/each}
	</section>
</main>
<style>
    .message {
        margin: 10px;
        padding: 10px;
        border-radius: 5px;
    }

    .inbound {
        background-color: #f0f0f0;

    }

    .outbound {
        background-color: #d0f0ff;
    }
</style>

