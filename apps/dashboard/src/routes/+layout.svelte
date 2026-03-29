<script lang="ts">
	import faviconLight from '$lib/assets/favicon-light.svg';
	import faviconDark from '$lib/assets/favicon-dark.svg';
	let { children } = $props();
	import "../app.css";
</script>

<svelte:head>
	<link
		href={faviconDark}
		media="(prefers-color-scheme: dark)"
		rel="icon"
		type="image/svg+xml"
	>
	<link
		href={faviconLight}
		media="(prefers-color-scheme: light)"
		rel="icon"
		type="image/svg+xml"
	>

	<title>Rosace</title>
</svelte:head>

{@render children()}
