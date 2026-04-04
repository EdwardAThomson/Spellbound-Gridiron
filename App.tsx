import React, { useState } from 'react';
import { GamePhase } from './types';
import { useGameEngine } from './hooks/useGameEngine';
import MainMenu from './components/MainMenu';
import TeamSelectScreen from './components/TeamSelectScreen';
import GameScreen from './components/GameScreen';
import PostGameScreen from './components/PostGameScreen';
import HalftimeScreen from './components/HalftimeScreen';
import RuleBookModal from './components/RuleBookModal';
import SettingsModal from './components/SettingsModal';
import { ApiKeysProvider } from './context/ApiKeysContext';
import { LLMProvider } from './utils/llmHelper';
import { DEFAULT_MODELS } from './constants/models';

export default function App() {
    // AI Engine State
    const [gameProvider, setGameProvider] = useState<LLMProvider>('gemini');
    const [gameModel, setGameModel] = useState<string>(DEFAULT_MODELS['gemini']);
    const [chatProvider, setChatProvider] = useState<LLMProvider>('gemini-cli');
    const [chatModel, setChatModel] = useState<string>(DEFAULT_MODELS['gemini-cli']);

    // Modal State
    const [showSettings, setShowSettings] = useState(false);
    const [showRules, setShowRules] = useState(false);

    const engine = useGameEngine(gameProvider, gameModel);

    return (
        <ApiKeysProvider>
            {engine.gameState.phase === GamePhase.MAIN_MENU && (
                <MainMenu
                    onQuickPlay={engine.goToTeamSelect}
                    onSettings={() => setShowSettings(true)}
                    onRules={() => setShowRules(true)}
                />
            )}

            {engine.gameState.phase === GamePhase.TEAM_SELECT && (
                <TeamSelectScreen
                    onStart={engine.startGame}
                    onBack={engine.goToMainMenu}
                />
            )}

            {engine.gameState.phase === GamePhase.PLAYING && (
                <GameScreen
                    gameState={engine.gameState}
                    isAiThinking={engine.isAiThinking}
                    interactionMode={engine.interactionMode}
                    targetingAction={engine.targetingAction}
                    selectedPlayer={engine.selectedPlayer}
                    allPlayers={engine.allPlayers}
                    gameModel={gameModel}
                    chatProvider={chatProvider}
                    chatModel={chatModel}
                    onTileClick={engine.handleTileClick}
                    onStartTargeting={engine.startTargeting}
                    onCancelTargeting={engine.cancelTargeting}
                    onEndPlayerAction={engine.endPlayerAction}
                    onEndTurn={engine.endTurn}
                    onShowSettings={() => setShowSettings(true)}
                    onShowRules={() => setShowRules(true)}
                    onQuit={engine.goToMainMenu}
                    onSummonWolf={engine.handleSummonWolf}
                />
            )}

            {engine.gameState.phase === GamePhase.HALFTIME && (
                <HalftimeScreen
                    gameState={engine.gameState}
                    onStartSecondHalf={engine.startSecondHalf}
                />
            )}

            {engine.gameState.phase === GamePhase.POST_GAME && (
                <PostGameScreen
                    gameState={engine.gameState}
                    onRematch={engine.rematch}
                    onMainMenu={engine.goToMainMenu}
                />
            )}

            <RuleBookModal isOpen={showRules} onClose={() => setShowRules(false)} />

            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                gameProvider={gameProvider}
                setGameProvider={setGameProvider}
                gameModel={gameModel}
                setGameModel={setGameModel}
                chatProvider={chatProvider}
                setChatProvider={setChatProvider}
                chatModel={chatModel}
                setChatModel={setChatModel}
            />
        </ApiKeysProvider>
    );
}
