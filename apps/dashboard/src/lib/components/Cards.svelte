<script lang="ts">
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import posthog from "posthog-js";

  const { user } = page.data;

  function formatter(date: number | undefined) {
    if (!date) return "";
    return new Date(date).toLocaleDateString();
  }
  const date = formatter(user!._creationTime);
</script>

<div class="relative h-screen bg-[#F0F0F0]">
  <div class="pointer-events-none fixed inset-0 z-50">
    <div
      class="after:animate-right-curtain dark:after:bg-tertiary dark:before:bg-tertiary after:bg-primary before:animate-left-curtain before:bg-primary absolute top-1/2 left-1/2 size-full -translate-1/2 scale-141 before:absolute before:-left-px before:h-full before:w-1/2 after:absolute after:-right-px after:h-full after:w-1/2"
    ></div>
    <div
      class="bg-primary dark:bg-tertiary animate-curtain-line absolute top-0 left-1/2 h-full w-0.75"
    ></div>
  </div>

  <div
    class="animate-page flex h-full items-center justify-center perspective-[1000px]"
  >
    <div class="relative mt-50 aspect-3/8 h-150 min-[26.5625rem]:h-200">
      <!-- Left Outer -->
      <div
        class="animate-card-fan absolute top-0 left-0 z-0 size-full origin-bottom [--delay:0.1s] [--rotate:-50deg]"
      >
        <div
          class="hover:shadow-card-hover shadow-card-default bg-secondary relative h-1/2 w-full rounded-xl duration-200"
        ></div>
      </div>
      <!-- Left Inner -->
      <div
        class="animate-card-fan absolute top-0 left-0 z-1 size-full origin-bottom [--delay:0.2s] [--rotate:-25deg]"
      >
        <div
          class="hover:shadow-card-hover shadow-card-default bg-tertiary relative h-1/2 w-full rounded-xl duration-200"
        ></div>
      </div>
      <!-- Center -->
      <div
        class="animate-card-fan absolute top-0 left-0 z-3 size-full origin-bottom [--delay:0s] [--rotate:0deg]"
      >
        <div class="group relative h-1/2 w-full rounded-xl">
          <div
            class="ease-in-out-circ absolute inset-0 rounded-xl transition-transform duration-600 transform-3d group-hover:rotate-y-180"
          >
            <!-- Front -->
            <div
              class="bg-primary text-background dark:text-primary dark:bg-background shadow-card-active absolute inset-0 flex flex-col justify-between overflow-hidden rounded-xl p-4 backface-hidden"
            >
              <div class="flex justify-between">
                <Icon name="rosace" class="size-4" />
                <date class="font-mono text-[0.625rem]/4">{date}</date>
              </div>
              <div class="flex flex-col items-start gap-14">
                <div class="flex flex-col gap-2">
                  <div class="text-[1.375rem]/none font-bold tracking-tight">
                    {user!.firstName}<br />{user!.lastName}
                  </div>
                  <span
                    class="text-[0.5rem]/none font-medium tracking-tight uppercase"
                    >Early Access</span
                  >
                </div>
                <div class="flex items-end justify-center gap-1">
                  <span class="text-[0.6875rem]/none font-bold tracking-tighter"
                    >Rosace</span
                  >
                  <div class="mb-px flex rounded-xs outline outline-current">
                    <span
                      class="px-0.5 py-px text-[0.375rem]/none font-extrabold tracking-tight uppercase"
                      >Beta</span
                    >
                  </div>
                </div>
              </div>
              <div
                class="bg-background dark:bg-primary absolute top-12.75 left-35 size-15.25 rounded-full"
              ></div>

              <div
                class="bg-background dark:bg-primary absolute top-35.5 left-34.25 h-10.75 w-24.25"
              ></div>

              <div
                class="bg-background dark:bg-primary absolute top-52.25 right-24 size-4"
              ></div>

              <div
                class="bg-background dark:bg-primary absolute right-4 bottom-20.75 h-21 w-15.75 [clip-path:polygon(0%_0%,100%_0%,0%_100%)] max-[26.5625rem]:hidden"
              ></div>

              <div
                class="bg-background dark:bg-primary absolute right-19.25 bottom-4.5 h-3.25 w-6.25"
              ></div>
            </div>
            <!-- Back -->
            <div
              class="bg-background dark:bg-primary-foreground shadow-card-active absolute inset-0 flex rotate-y-180 flex-col justify-center space-y-3 rounded-xl p-7 text-[0.8125rem] font-medium text-pretty backface-hidden"
            >
              <p>Hey {user!.firstName},</p>
              <p>
                Thanks for joining so early. I'm working hard to make it worth
                the wait.
              </p>
              <p>I'll let you know when you're in.</p>
              <div>
                <p>Armand</p>
                <p>Founder @ Rosace</p>
              </div>
              <div
                class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-end justify-center gap-1"
              >
                <span class="text-[0.6875rem]/none font-bold tracking-tighter"
                  >Rosace</span
                >
                <div class="mb-px flex rounded-xs outline outline-current">
                  <span
                    class="px-0.5 py-px text-[0.375rem]/none font-extrabold tracking-tight uppercase"
                    >Beta</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Right Inner -->
      <div
        class="animate-card-fan absolute top-0 left-0 z-1 size-full origin-bottom [--delay:0.2s] [--rotate:25deg]"
      >
        <div
          class="hover:shadow-card-hover shadow-card-default bg-tertiary relative h-1/2 w-full rounded-xl duration-200"
        ></div>
      </div>
      <!-- Right Outer -->
      <div
        class="animate-card-fan absolute top-0 left-0 z-0 size-full origin-bottom [--delay:0.1s] [--rotate:50deg]"
      >
        <div
          class="hover:shadow-card-hover shadow-card-default bg-secondary relative h-1/2 w-full rounded-xl duration-200"
        ></div>
      </div>
      <!-- Controls -->
      <div
        class="absolute bottom-40 left-1/2 size-20 -translate-x-1/2 bg-red-500 not-pointer-coarse:hidden"
      ></div>
    </div>
  </div>
</div>

<form
  class="absolute top-5 right-8"
  method="POST"
  onsubmit={() => posthog.reset()}
>
  <button
    class="bg-primary hover:bg-primary/80 text-primary-foreground flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-lg font-bold transition-colors duration-200"
    type="submit">Sign out</button
  >
</form>
