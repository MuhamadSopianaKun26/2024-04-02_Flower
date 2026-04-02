'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import appData from '../data.json'

// Asset resolution mappings
const GIF_MAP: Record<string, string> = {
    "angry": "/assets/image/Angrycat.gif",
    "upset": "/assets/image/upsetCat.gif",
    "yapapa": "/assets/image/yapapacat.gif",
    "yapap": "/assets/image/yapapacat.gif",
    "huh": "/assets/image/huhCat.gif",
    "happy": "/assets/image/happyCat.gif",
    "shy": "/assets/image/Shycats.gif",
    // Old fallbacks
    "kucing_kaget.gif": "/assets/image/Angrycat.gif",
    "kucing_marah.gif": "/assets/image/Angrycat.gif",
    "kucing_curiga.gif": "/assets/image/upsetCat.gif",
    "kucing_mikir.gif": "/assets/image/huhCat.gif",
    "kucing_siap.gif": "/assets/image/happyCat.gif",
    "kucing_tanya.gif": "/assets/image/huhCat.gif",
    "kucing_tanya_2.gif": "/assets/image/huhCat.gif",
    "kucing_kecewa.gif": "/assets/image/upsetCat.gif",
    "kucing_judes.gif": "/assets/image/upsetCat.gif",
    "kucing_lelah.gif": "/assets/image/upsetCat.gif",
    "kucing_romantis.gif": "/assets/image/Shycats.gif",
    "kucing_peluk.gif": "/assets/image/happyCat.gif"
};

const getGifPath = (key: string) => GIF_MAP[key] || `/assets/image/${key}`;

// Helper to find step
const getStep = (id: string) => appData.storyline.find((s) => s.id === id);

type Phase =
    | 'text_sequence' // Normal text sequence (texts or long_texts)
    | 'interaction' // Displaying input/buttons/grid
    | 'wrong_sequence' // Showing on_wrong texts
    | 'wrong_retry' // Showing retry button
    | 'correct_sequence' // Showing on_correct_talk texts
    | 'transition' // Awaiting transition
    | 'music_prompt' // Special state to ask to play music
    | 'gift_interaction' // Tapping the gift
    | 'popup_card'
    | 'final';

export default function AnniversaryApp() {
    const [currentStepId, setCurrentStepId] = useState('intro_1');
    const [phase, setPhase] = useState<Phase>('text_sequence');
    const [textIndex, setTextIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [userInput, setUserInput] = useState('');

    // Gift State
    const [giftClicks, setGiftClicks] = useState(0);
    const [giftExploded, setGiftExploded] = useState(false);

    // Audio refs
    const typingAudioRef = useRef<HTMLAudioElement | null>(null);
    const popAudioRef = useRef<HTMLAudioElement | null>(null);
    const bgmRef = useRef<HTMLAudioElement | null>(null);
    const activeTypingRef = useRef<number>(0);

    const step = getStep(currentStepId);

    // Derive active text array to show based on phase
    let activeTextArray: any[] = [];
    if (step) {
        if (phase === 'text_sequence') activeTextArray = (step as any).texts || [];
        else if (phase === 'wrong_sequence') activeTextArray = (step as any).on_wrong?.texts || (step as any).on_wrong_talk || [];
        else if (phase === 'correct_sequence') activeTextArray = (step as any).on_correct_talk || [];
        // If it's a phase that doesn't use typing sequence, array is empty
    }

    useEffect(() => {
        // Init audio on mount
        try {
            typingAudioRef.current = new Audio('/assets/audio/typing.mp3');
            typingAudioRef.current.volume = 0.2;
            popAudioRef.current = new Audio('/assets/audio/pop.m4a');
            popAudioRef.current.volume = 0.5;
        } catch (e) {
            console.log('Audio init error', e);
        }
    }, []);

    const playPop = () => {
        if (popAudioRef.current) {
            popAudioRef.current.currentTime = 0;
            popAudioRef.current.play().catch(() => { });
        }
    };

    const playBGM = (audioFile: string) => {
        try {
            if (!bgmRef.current) {
                bgmRef.current = new Audio(`/assets/audio/${audioFile}`);
                bgmRef.current.volume = 0.6;
            }
            bgmRef.current.play().catch(() => console.log('BGM block'));
        } catch (e) { }
    };

    const typeText = async (text: string) => {
        const currentId = Date.now() + Math.random();
        activeTypingRef.current = currentId;
        setIsTyping(true);
        setDisplayedText('');

        if (typingAudioRef.current) {
            typingAudioRef.current.currentTime = 0;
            typingAudioRef.current.play().catch(() => { });
        }

        let current = '';
        for (let i = 0; i < text.length; i++) {
            if (activeTypingRef.current !== currentId) return;
            current += text[i];
            setDisplayedText(current);
            await new Promise(r => setTimeout(r, 40)); // Typing speed
        }

        if (activeTypingRef.current === currentId) {
            setIsTyping(false);
            if (typingAudioRef.current) {
                typingAudioRef.current.pause();
            }
        }
    };

    // Run typing effect when textIndex or phase changes AND we are in a sequence phase
    useEffect(() => {
        if (!step) return;
        const textArr = activeTextArray;

        if (textArr && textArr.length > 0 && textIndex < textArr.length) {
            const currentItem = textArr[textIndex];
            const textToType = typeof currentItem === 'string' ? currentItem : currentItem.text;
            typeText(textToType);
        } else {
            // Reached the end of the current text sequence. Transition to next logical phase.
            const isSequencePhase = phase === 'text_sequence' || phase === 'wrong_sequence' || phase === 'correct_sequence';
            const isEndOfSequence = (textArr.length > 0 && textIndex >= textArr.length) || (textArr.length === 0 && isSequencePhase);

            if (isEndOfSequence) {
                if (phase === 'text_sequence') {
                    if (step.type === 'talking') {
                        // Complete normal talk -> jump to next_step
                        if ((step as any).next_step) advanceStep((step as any).next_step);
                    } else if (step.type === 'talking_music') {
                        // Before interaction, ask to play music or just start long texts
                        if ((step as any).music_trigger && !bgmRef.current) {
                            setPhase('music_prompt');
                        } else {
                            // Wait, talking_music has texts AND long_texts. 
                            // We should move to interaction after long texts, or wait for next_step
                            if ((step as any).next_step) advanceStep((step as any).next_step);
                        }
                    } else if (step.type === 'gift_interaction') {
                        setPhase('gift_interaction');
                    } else {
                        setPhase('interaction'); // Questions will now show interactive fields
                    }
                } else if (phase === 'wrong_sequence') {
                    setPhase('wrong_retry');
                } else if (phase === 'correct_sequence') {
                    // Finished playing correct sequence -> jump to next step
                    if ((step as any).on_correct_step) advanceStep((step as any).on_correct_step);
                    else if ((step as any).next_step) advanceStep((step as any).next_step);
                }
            } else if (phase === 'transition' && step.type === 'special_transition') {
                // Handle special transition pause
                const waitMs = (step as any).wait_time || 3000;

                const audioFile = step.id === 'sesi3_anniversary' ? 'drum.m4a' : (step as any).sfx;
                if (audioFile) {
                    try {
                        const sfx = new Audio(`/assets/audio/${audioFile}`);
                        sfx.volume = 0.8;
                        sfx.play().catch(() => { });
                    } catch (e) { }
                }

                const timer = setTimeout(() => {
                    advanceStep((step as any).next_step);
                }, waitMs);
                return () => clearTimeout(timer);
            } else if (phase === 'final') {
                // Final output type
                typeText((step as any).main_text);
            } else if (phase === 'popup_card') {
                typeText((step as any).content);
            }
        }
    }, [currentStepId, phase, textIndex]);

    const advanceStep = (nextId: string) => {
        setCurrentStepId(nextId);
        setTextIndex(0);
        setDisplayedText('');
        setUserInput('');
        setGiftClicks(0);
        setGiftExploded(false);

        const nextStep = getStep(nextId);
        if (!nextStep) return;

        if (nextStep.type === 'special_transition') setPhase('transition');
        else if (nextStep.type === 'final') setPhase('final');
        else if (nextStep.type === 'popup_card') setPhase('popup_card');
        else setPhase('text_sequence');
    };

    const fireConfetti = () => {
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({
                ...defaults, particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                colors: ['#ffb6c1', '#ffc0cb', '#ffffff']
            });
            confetti({
                ...defaults, particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                colors: ['#ffb6c1', '#fecfef', '#ffffff']
            });
        }, 250);
    };

    // Screen-wide click handler for normal text sequence advancing
    const handleGlobalTap = () => {
        if (isTyping) return; // Prevent skipping typing? Or allow? Keep it disabled for now to be safe

        if (phase === 'text_sequence' || phase === 'wrong_sequence' || phase === 'correct_sequence') {
            playPop();
            setTextIndex(prev => prev + 1);
        }
    };

    const handleInputSubmit = () => {
        playPop();
        if (!step) return;
        const ans = userInput.toLowerCase().trim();

        if (step.type === 'question_input') {
            const valids: string[] = (step as any).valid_answers || [];
            if (valids.some(v => ans.includes(v))) {
                if ((step as any).on_correct_talk) {
                    setPhase('correct_sequence');
                    setTextIndex(0);
                } else {
                    advanceStep((step as any).on_correct || (step as any).on_correct_step);
                }
            } else {
                setPhase('wrong_sequence');
                setTextIndex(0);
            }
        } else if (step.type === 'question_input_list') {
            const keys: string[] = (step as any).required_keywords || [];
            const matches = keys.filter(k => ans.includes(k.toLowerCase()));
            if (matches.length >= ((step as any).min_match || 5)) {
                setPhase('correct_sequence');
                setTextIndex(0);
            } else {
                setPhase('wrong_sequence');
                setTextIndex(0);
            }
        }
    };

    const handleChoice = (isCorrect: boolean) => {
        playPop();
        if (isCorrect) {
            if ((step as any).on_correct_talk) {
                setPhase('correct_sequence');
                setTextIndex(0);
            } else {
                advanceStep((step as any).on_correct_step);
            }
        } else {
            if ((step as any).on_wrong_talk) {
                // Wait, bonus_ganteng has on_wrong_talk sequence. Let me treat it as normal wrong or correct sequence
                // Ah wait, data.json uses on_wrong_talk array! Let me hack it via correct_sequence to play the array
                // It actually jumps to next_step regardless. So it's safe to just set it to a sequence
                // Wait, the hook above doesn't map on_wrong_talk. Let's just do wrong_sequence and map it there.
                setPhase('wrong_sequence');
                setTextIndex(0);
            } else {
                setPhase('wrong_sequence');
                setTextIndex(0);
            }
        }
    };

    const handleGiftClick = () => {
        playPop();
        if (giftClicks < 4) {
            setGiftClicks(c => c + 1);
        } else {
            setGiftExploded(true);
            fireConfetti();
        }
    };

    // Render elements based on phase/step
    if (!step) return null;

    // Determine current GIF based on phase
    let activeGif = step.gif;

    if (activeTextArray.length > 0 && textIndex < activeTextArray.length) {
        const currentItem = activeTextArray[textIndex];
        if (typeof currentItem === 'object' && currentItem.gif) {
            activeGif = currentItem.gif;
        }
    }

    if (phase === 'wrong_sequence' || phase === 'wrong_retry') activeGif = (step as any).on_wrong?.gif || 'angry'; // angry/upset default
    else if (phase === 'correct_sequence') activeGif = 'happy'; // default correct

    if (step.id === 'bonus_ganteng' && phase === 'wrong_sequence') {
        activeGif = 'upset'; // explicit upset
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[url('/assets/image/background.png')] bg-cover bg-center bg-fixed">
            {/* Swimming Fish Background */}
            <div className="fish-right" style={{ top: '12%', animationDelay: '0s', fontSize: '1.8rem' }}>🐠</div>
            <div className="fish-right" style={{ top: '28%', animationDelay: '3s', fontSize: '1.4rem' }}>🐟</div>
            <div className="fish-right" style={{ top: '45%', animationDelay: '6s', fontSize: '2.2rem' }}>🐡</div>
            <div className="fish-right" style={{ top: '78%', animationDelay: '4s', fontSize: '1.5rem' }}>🐋</div>

            <div className="fish-left" style={{ top: '18%', animationDelay: '2s', fontSize: '1.6rem' }}>🦈</div>
            <div className="fish-left" style={{ top: '35%', animationDelay: '5s', fontSize: '1.3rem' }}>🐠</div>
            <div className="fish-left" style={{ top: '52%', animationDelay: '8s', fontSize: '2rem' }}>🐬</div>
            <div className="fish-left" style={{ top: '85%', animationDelay: '7s', fontSize: '1.4rem' }}>🦑</div>

            <div className="mobile-container w-full max-w-md mx-auto" onClick={handleGlobalTap}>
                <AnimatePresence mode="wait">
                    {phase === 'final' ? (
                        <motion.div
                            key="finalScreen"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 2 }}
                            className="content-card flex flex-col items-center justify-center text-center p-8 border-none bg-black/80 shadow-[0_0_50px_rgba(255,105,180,0.4)]"
                        >
                            {step.gif && <img src={getGifPath(step.gif)} alt="Cat" className="cat-gif mb-6" />}
                            <h1 className="text-pink-200 text-[1.1rem] md:text-xs font-semibold leading-relaxed mb-6 mt-2 text-shadow-soft drop-shadow-[0_0_10px_rgba(255,182,193,0.8)] px-4">
                                {displayedText}
                            </h1>
                            <p className="text-pink-200 text-sm font-light mt-auto">{(step as any).footer}</p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="mainContent"
                            className="content-card"
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            onClick={(e) => e.stopPropagation()} // Prevent global click on card interactions
                        >
                            {/* Top Character */}
                            {activeGif && phase !== 'gift_interaction' && phase !== 'popup_card' && (
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={`${activeGif}-${phase}`}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: (phase === 'transition' && step.id === 'sesi3_anniversary') ? 1.5 : (isTyping ? 1.05 : 1) }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{
                                            duration: (phase === 'transition' && step.id === 'sesi3_anniversary') ? ((step as any).wait_time / 1000) : 0.3,
                                            ease: (phase === 'transition' && step.id === 'sesi3_anniversary') ? "easeInOut" : "easeOut"
                                        }}
                                        className="mb-6 w-full flex justify-center mt-2 relative z-10"
                                    >
                                        <img src={getGifPath(activeGif)} alt="Character" className="cat-gif ring-4 ring-pink-100 shadow-[0_0_25px_rgba(255,182,193,0.5)]" />
                                    </motion.div>
                                </AnimatePresence>
                            )}

                            {/* Speech Bubble Area */}
                            <AnimatePresence mode="wait">
                                {(phase === 'text_sequence' || phase === 'wrong_sequence' || phase === 'correct_sequence' || phase === 'transition' || phase === 'popup_card') && (
                                    <motion.div
                                        className="text-center min-h-[120px] flex flex-col items-center justify-center w-full px-4"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={handleGlobalTap} // Allow tapping bubble itself
                                    >
                                        <p className="text-lg md:text-xl text-pink-600 center-text font-bold text-shadow-soft leading-relaxed break-words">
                                            {displayedText}
                                            {isTyping && <span className="typewriter-cursor">|</span>}
                                        </p>

                                        {!isTyping && activeTextArray.length > 0 && textIndex < activeTextArray.length && (
                                            <motion.div
                                                className="mt-6 flex justify-center w-full relative z-50"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                            >
                                                <button onClick={(e) => { e.stopPropagation(); handleGlobalTap(); }} className="text-pink-500 text-sm font-medium animate-pulse cursor-pointer !bg-transparent !border-none !outline-none !shadow-none hover:!bg-transparent">
                                                    {step.id === 'sesi4_gift' && textIndex === activeTextArray.length - 1 ? 'Buka kado 🎁' : 'tekan untuk lanjut...'}
                                                </button>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Interactive Areas */}
                            <AnimatePresence mode="wait">
                                {phase === 'interaction' && (
                                    <motion.div
                                        className="w-full flex flex-col items-center gap-4 mt-2"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        {/* Question Prompts */}
                                        {(step.type === 'question_input' || step.type === 'question_input_list' || step.type === 'question_choice' || step.type === 'question_button' || step.type === 'question_image') && (
                                            <p className="text-center text-pink-600 mb-2 font-bold drop-shadow-sm">
                                                {(step as any).question}
                                            </p>
                                        )}
                                        {(step as any).sub_text && (
                                            <p className="text-center text-pink-400 text-xs mt(-2) mb-2 italic">
                                                {(step as any).sub_text}
                                            </p>
                                        )}

                                        {/* Input Type */}
                                        {(step.type === 'question_input' || step.type === 'question_input_list') && (
                                            <div className="w-full flex flex-col items-center">
                                                <input
                                                    type="text"
                                                    placeholder={(step as any).placeholder || 'Ketik di sini...'}
                                                    value={userInput}
                                                    onChange={(e) => setUserInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
                                                    className="cute-input"
                                                    autoFocus
                                                />
                                                <button onClick={handleInputSubmit} disabled={!userInput.trim()} className="cute-button">
                                                    Kirim
                                                </button>
                                            </div>
                                        )}

                                        {/* Choice Type */}
                                        {step.type === 'question_choice' && (
                                            <div className="flex flex-col gap-3 w-full">
                                                {((step as any).options as string[]).map((opt, i) => (
                                                    <button key={i} className="option-button" onClick={() => handleChoice(opt === (step as any).correct_answer)}>
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Button Type */}
                                        {step.type === 'question_button' && (
                                            <div className="flex flex-col items-center justify-center gap-3 w-full">
                                                {((step as any).options as any[]).map((opt, i) => (
                                                    <button key={i} className="cute-button !w-fit px-8 mx-auto" onClick={() => { playPop(); advanceStep(opt.next_step); }}>
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Image Grid Type */}
                                        {step.type === 'question_image' && (
                                            <div className="grid grid-cols-2 gap-4 w-full p-2">
                                                {((step as any).images as any[]).map((img, i) => (
                                                    <button
                                                        key={i}
                                                        className="relative group bg-pink-50 p-2 rounded-2xl border-4 border-transparent hover:border-pink-300 transition-all shadow-md hover:shadow-xl overflow-hidden aspect-square flex items-center justify-center"
                                                        onClick={() => handleChoice(img.id === (step as any).correct_id)}
                                                    >
                                                        <img src={img.url.startsWith('/') ? img.url : `/assets/image/${img.url}`} alt={`Opt ${i}`} className="w-full h-full object-cover rounded-xl group-hover:scale-110 transition-transform" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Music Prompt */}
                                {phase === 'music_prompt' && (
                                    <motion.div
                                        className="w-full flex flex-col items-center mt-6"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                    >
                                        <button className="cute-button" onClick={() => {
                                            playPop();
                                            playBGM((step as any).music_trigger.file);
                                            // Start the long txt sequence by overwriting texts array temporarily mapping
                                            // Oh wait! the phase isn't right if I just switch to long text here
                                            // I'll manually set `activeTextArray` behavior logic using texts
                                            // Let's hack it by modifying the state.
                                            setPhase('text_sequence');
                                            // To show 'long_texts', I will swap it in the reference memory instead of mutating data.json
                                            (step as any).texts = (step as any).long_texts;
                                            setTextIndex(0);
                                        }}>
                                            {(step as any).music_trigger.label}
                                        </button>
                                    </motion.div>
                                )}

                                {/* Retry Button */}
                                {phase === 'wrong_retry' && (
                                    <motion.div
                                        className="w-full flex flex-col items-center mt-6"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                    >
                                        <button className="cute-button bg-red-400" onClick={() => {
                                            playPop();
                                            // If bonus_ganteng, wrong sequence means we just advance to next anyway because it's a joke
                                            if (step.id === 'bonus_ganteng' && (step as any).next_step) {
                                                advanceStep((step as any).next_step);
                                            } else {
                                                setPhase('interaction');
                                            }
                                        }}>
                                            {(step as any).on_wrong?.retry_label || "Coba Lagi 🥲"}
                                        </button>
                                    </motion.div>
                                )}

                                {/* Gift Interaction */}
                                {phase === 'gift_interaction' && (
                                    <motion.div
                                        className="w-full flex flex-col items-center justify-center py-8 relative"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        {!giftExploded ? (
                                            <>
                                                <p className="text-pink-500 font-bold mb-8 animate-pulse text-lg">Tap kado nya {5 - giftClicks}x !!</p>
                                                <motion.div
                                                    className="w-64 h-64 md:w-72 md:h-72 cursor-pointer relative mt-4 mb-4"
                                                    animate={{
                                                        scale: 1 + (giftClicks * 0.1),
                                                        rotate: giftClicks > 0 ? [-5, 5, -5, 0] : 0,
                                                        boxShadow: `0px 0px ${giftClicks * 25}px ${giftClicks * 8}px rgba(255, 235, 133, ${0.4 + giftClicks * 0.15})`
                                                    }}
                                                    transition={{
                                                        scale: { type: "spring", stiffness: 300 },
                                                        rotate: { type: "tween", duration: 0.3 },
                                                        boxShadow: { duration: 0.3 }
                                                    }}
                                                    onClick={handleGiftClick}
                                                >
                                                    {/* Beautiful CSS Birthday Gift Box */}
                                                    <div className="absolute inset-0 bg-rose-300 rounded-2xl shadow-inner border-[6px] border-rose-400 flex items-center justify-center overflow-visible">
                                                        {/* Pita Vertikal */}
                                                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-10 bg-rose-500 shadow-sm z-10 border-x-2 border-rose-600" />
                                                        {/* Pita Horizontal */}
                                                        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-10 bg-rose-500 shadow-sm z-10 border-y-2 border-rose-600" />
                                                        {/* Tali Pita Atas (Bow) */}
                                                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex justify-center w-full z-20">
                                                            <div className="w-16 h-20 bg-rose-500 rounded-full scale-x-[1.8] rotate-[-40deg] origin-bottom-right relative left-2 border-[4px] border-rose-600 shadow-sm" />
                                                            <div className="w-16 h-20 bg-rose-500 rounded-full scale-x-[1.8] rotate-[40deg] origin-bottom-left relative right-2 border-[4px] border-rose-600 shadow-sm" />
                                                            <div className="w-10 h-10 bg-rose-700 rounded-full absolute -bottom-4 z-30 shadow-md transform -translate-x-1/2 left-1/2 border-[3px] border-rose-800" />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            </>
                                        ) : (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: "spring" }}
                                                className="text-center"
                                            >
                                                <span className="text-[12rem] md:text-[15rem] block mb-6 animate-bounce drop-shadow-[0_10px_20px_rgba(255,182,193,0.8)] leading-none mt-4">💐</span>
                                                <h2 className="text-2xl font-bold text-pink-600 mb-2">{(step as any).gift_config?.final_message}</h2>
                                                <p className="text-pink-400 mb-6 drop-shadow-md">{(step as any).gift_config?.sub_message}</p>
                                                <button className="cute-button w-full" onClick={() => advanceStep((step as any).next_step)}>
                                                    {(step as any).gift_config?.button_label}
                                                </button>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Popup Card Next Button */}
                                {phase === 'popup_card' && !isTyping && (
                                    <motion.div
                                        className="w-full flex flex-col items-center mt-8"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                    >
                                        <button className="cute-button" onClick={() => advanceStep((step as any).next_step)}>
                                            {(step as any).button_label}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Quick Navigation Bar */}
            <div className="fixed bottom-[100px] left-0 w-full flex flex-col items-center gap-2 px-2 z-[999] pointer-events-none">
                <div className="pointer-events-auto bg-pink-400/90 text-white text-[0.65rem] uppercase font-bold tracking-widest px-3 py-1 backdrop-blur-sm">
                    pergi ke sesi :
                </div>
                <div className="flex flex-wrap justify-center bg-white/70 p-2.5 rounded-3xl backdrop-blur-md shadow-[0_8px_20px_rgba(255,182,193,0.6)] border-pink-200 pointer-events-auto gap-2">
                    <button className="bg-[linear-gradient(135deg,#ff9a9e_0%,#fecfef_100%)] text-[#c9184a] px-3 py-1.5 text-[0.6rem] hover:scale-105 transition-transform" onClick={(e) => { playPop(); advanceStep('intro_1'); }}>Restart</button>
                    <button className="bg-[linear-gradient(135deg,#ff9a9e_0%,#fecfef_100%)] text-[#c9184a] px-3 py-1.5 text-[0.6rem] hover:scale-105 transition-transform" onClick={(e) => { playPop(); advanceStep('cek_kesiapan'); }}>Test</button>
                    <button className="bg-[linear-gradient(135deg,#ff9a9e_0%,#fecfef_100%)] text-[#c9184a] px-3 py-1.5 text-[0.6rem] hover:scale-105 transition-transform" onClick={(e) => { playPop(); advanceStep('ucapan_utama'); }}>Ucapan</button>
                    <button className="bg-[linear-gradient(135deg,#ff9a9e_0%,#fecfef_100%)] text-[#c9184a] px-3 py-1.5 text-[0.6rem] hover:scale-105 transition-transform" onClick={(e) => { playPop(); advanceStep('sesi4_gift'); }}>Gift</button>
                </div>
            </div>
        </div>
    )
}
