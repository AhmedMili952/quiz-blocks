'use strict';

module.exports = function createExamHandlers(ctx) {
	// Variables locales pour le timer
	let examTimerId = null;
	let examStartTime = 0;

	function examTimerHtml() {
		if (!ctx.isExamMode || !ctx.examOptions.showTimer) return "";
		if (!ctx.examStarted) {
			return `<div class="quiz-exam-start-screen" data-exam-start-screen="1">
				<div class="quiz-exam-start-content">
					<div class="quiz-exam-start-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="10" x2="14" y1="2" y2="2"></line>
							<line x1="12" x2="15" y1="14" y2="11"></line>
							<circle cx="12" cy="14" r="8"></circle>
						</svg>
					</div>
					<div class="quiz-exam-start-title">Mode Examen</div>
					<div class="quiz-exam-start-duration">Durée : ${ctx.examOptions.durationMinutes} minutes</div>
					<button class="quiz-exam-start-btn" type="button">Commencer l'examen</button>
				</div>
			</div>`;
		}

		const minutes = Math.floor(ctx.examTimeRemaining / 60000);
		const seconds = Math.floor((ctx.examTimeRemaining % 60000) / 1000);
		const timerDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

		return `<div class="quiz-exam-timer" data-exam-timer="1">
			<div class="quiz-exam-timer-bar">
				<div class="quiz-exam-timer-progress" data-exam-progress="1"></div>
			</div>
			<div class="quiz-exam-timer-text" data-exam-text="1">${timerDisplay}</div>
		</div>`;
	}

	function startExamTimer() {
		if (!ctx.isExamMode || examTimerId || !ctx.examStarted || ctx.examEnded) return;

		stopExamTimer();

		examStartTime = Date.now();
		ctx.examTimeRemaining = ctx.examDurationMs;
		updateExamTimerDisplay();

		let animationFrameId = null;

		const tick = () => {
			if (ctx.examEnded) return;

			const elapsed = Date.now() - examStartTime;
			ctx.examTimeRemaining = Math.max(0, ctx.examDurationMs - elapsed);

			updateExamTimerDisplay();

			if (ctx.examTimeRemaining <= 0) {
				handleExamTimeUp();
				return;
			}

			animationFrameId = requestAnimationFrame(tick);
		};

		animationFrameId = requestAnimationFrame(tick);
		examTimerId = animationFrameId;
	}

	function startExam() {
		if (!ctx.isExamMode || ctx.examStarted) return;
		ctx.examStarted = true;
		// Lancer le timer avant le rendu pour éviter les doubles appels
		startExamTimer();
		// Faire le rendu complet du quiz
		ctx.render();
	}

	function updateExamTimerDisplay() {
		const progressEl = ctx.container?.querySelector('[data-exam-progress="1"]');
		const textEl = ctx.container?.querySelector('[data-exam-text="1"]');

		if (!progressEl || !textEl) return;

		const pct = Math.max(0, Math.min(100, (ctx.examTimeRemaining / ctx.examDurationMs) * 100));
		progressEl.style.width = `${pct}%`;

		const minutes = Math.floor(ctx.examTimeRemaining / 60000);
		const seconds = Math.floor((ctx.examTimeRemaining % 60000) / 1000);
		textEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

		const timerContainer = ctx.container?.querySelector('[data-exam-timer="1"]');
		if (timerContainer) {
			timerContainer.classList.remove('quiz-exam-timer-warning', 'quiz-exam-timer-danger');
			if (pct <= 20) timerContainer.classList.add('quiz-exam-timer-danger');
			else if (pct <= 50) timerContainer.classList.add('quiz-exam-timer-warning');
		}
	}

	function handleExamTimeUp() {
		if (ctx.examEnded) return;
		ctx.examEnded = true;

		// Arrêter le timer et mettre à jour l'affichage avec le temps restant (0:00)
		stopExamTimer();
		updateExamTimerDisplay();

		// Verrouiller le quiz
		ctx.quizState.locked = true;

		// Aller directement aux résultats (comme un clic sur "Voir le score")
		ctx.goToResults();

		if (typeof ctx.Notice === 'function') {
			new ctx.Notice('Temps écoulé ! Le quiz a été verrouillé.', 5000);
		}
	}

	function stopExamTimer() {
		if (examTimerId) {
			cancelAnimationFrame(examTimerId);
			examTimerId = null;
		}
	}

	function bindExamStartButton() {
		const btn = ctx.container?.querySelector('[data-exam-start-screen="1"] .quiz-exam-start-btn');
		if (btn) {
			btn.addEventListener('click', () => {
				startExam();
			});
		}
	}

	return {
		examTimerHtml,
		startExamTimer,
		startExam,
		updateExamTimerDisplay,
		handleExamTimeUp,
		stopExamTimer,
		bindExamStartButton
	};
};
