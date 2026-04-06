'use strict';

module.exports = function createLifecycleHandlers(ctx) {
	function restartAsyncLifecycle() {
		ctx.__quizAsyncEpoch++;
		ctx.resolveAllPendingAsync(false);
		ctx.clearBackgroundWarmIdleHandle();
		ctx.cancelEnsureTrackVisibleRaf();

		if (ctx.__quizBootstrapRaf1) {
			cancelAnimationFrame(ctx.__quizBootstrapRaf1);
			ctx.__quizBootstrapRaf1 = 0;
		}
		if (ctx.__quizBootstrapRaf2) {
			cancelAnimationFrame(ctx.__quizBootstrapRaf2);
			ctx.__quizBootstrapRaf2 = 0;
		}

		ctx.__quizBackgroundWarmStarted = false;
		ctx.__quizWarmSlidePromises.clear();
	}

	function bumpSlideGeneration(index) {
		if (Number.isFinite(ctx.__quizSlideGeneration[index])) ctx.__quizSlideGeneration[index]++;
	}

	function bumpAllSlideGenerations() {
		for (let i = 0; i < ctx.__quizSlideGeneration.length; i++) ctx.__quizSlideGeneration[i]++;
	}

	function createPendingAsyncWaiter(cleanup = null) {
		const waiter = {
			settled: false,
			cleanup,
			promise: null,
			_resolve: null,
			resolve(value) {
				if (waiter.settled) return;
				waiter.settled = true;
				try { waiter.cleanup?.(); } catch (_) {}
				ctx.__quizPendingAsyncWaiters.delete(waiter);
				waiter._resolve(value);
			}
		};
		waiter.promise = new Promise(resolve => { waiter._resolve = resolve; });
		ctx.__quizPendingAsyncWaiters.add(waiter);
		return waiter;
	}

	function resolveAllPendingAsync(value = false) {
		for (const waiter of [...ctx.__quizPendingAsyncWaiters]) {
			try { waiter.resolve(value); } catch (_) {}
		}
	}

	async function sleep(ms, epoch = ctx.currentAsyncEpoch()) {
		let timer = 0;
		const waiter = createPendingAsyncWaiter(() => timer && clearTimeout(timer));
		timer = window.setTimeout(() => waiter.resolve(ctx.isQuizInstanceAlive(epoch)), Math.max(0, Number(ms) || 0));
		return waiter.promise;
	}

	function nextFrame(epoch = ctx.currentAsyncEpoch()) {
		let raf = 0;
		const waiter = createPendingAsyncWaiter(() => raf && cancelAnimationFrame(raf));
		raf = requestAnimationFrame(() => waiter.resolve(ctx.isQuizInstanceAlive(epoch)));
		return waiter.promise;
	}

	async function waitFrames(count = 1, epoch = ctx.currentAsyncEpoch()) {
		for (let i = 0; i < count; i++) {
			const alive = await nextFrame(epoch);
			if (!alive) return false;
		}
		return ctx.isQuizInstanceAlive(epoch);
	}

	function requestQuizIdle(timeout = 500, epoch = ctx.currentAsyncEpoch()) {
		const waiter = createPendingAsyncWaiter(() => ctx.clearBackgroundWarmIdleHandle());
		if ('requestIdleCallback' in window) {
			ctx.__quizBackgroundWarmIdleType = 'idle';
			ctx.__quizBackgroundWarmIdleHandle = window.requestIdleCallback(() => {
				ctx.__quizBackgroundWarmIdleHandle = 0;
				ctx.__quizBackgroundWarmIdleType = '';
				waiter.resolve(ctx.isQuizInstanceAlive(epoch));
			}, { timeout });
			return waiter.promise;
		}
		ctx.__quizBackgroundWarmIdleType = 'timeout';
		ctx.__quizBackgroundWarmIdleHandle = window.setTimeout(() => {
			ctx.__quizBackgroundWarmIdleHandle = 0;
			ctx.__quizBackgroundWarmIdleType = '';
			waiter.resolve(ctx.isQuizInstanceAlive(epoch));
		}, Math.min(timeout, 80));
		return waiter.promise;
	}

	return {
		restartAsyncLifecycle,
		bumpSlideGeneration,
		bumpAllSlideGenerations,
		createPendingAsyncWaiter,
		resolveAllPendingAsync,
		sleep,
		nextFrame,
		waitFrames,
		requestQuizIdle
	};
};
