import { h, render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { getWhaleAlerts } from './services/ave/monitor';
import { getTradingSignals } from './services/ave/signals';
import { getPortfolio } from './services/ave/portfolio';
import { checkWalletStatus, connectWallet } from './services/ave/trading';
import './styles/crypto-app.css';
function formatAddress(addr) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
function formatUsd(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
function formatNumber(value, decimals = 2) {
    return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function WhaleAlertsWidget() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        async function fetchAlerts() {
            try {
                const data = await getWhaleAlerts(10);
                setAlerts(data);
            }
            catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to fetch whale alerts');
            }
            finally {
                setLoading(false);
            }
        }
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
    }, []);
    if (loading)
        return h('div', { class: 'widget-loading' }, 'Loading whale alerts...');
    if (error)
        return h('div', { class: 'widget-error' }, error);
    return h('div', { class: 'whale-alerts-widget' }, h('h3', null, '🐋 Whale Alerts'), h('div', { class: 'alerts-list' }, alerts.map((alert, i) => h('div', { key: i, class: `alert-item ${alert.chain.toLowerCase()}` }, h('div', { class: 'alert-token' }, h('span', { class: 'token-symbol' }, alert.tokenSymbol), h('span', { class: 'chain-badge' }, alert.chain)), h('div', { class: 'alert-details' }, h('span', { class: 'alert-amount' }, `${formatNumber(alert.amount, 0)} ${alert.tokenSymbol}`), h('span', { class: 'alert-value' }, formatUsd(alert.valueUsd))), h('div', { class: 'alert-type', 'data-type': alert.type }, alert.type === 'buy' ? '📈 BUY' : '📉 SELL')))));
}
function TradingSignalsWidget() {
    const [signals, setSignals] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        async function fetchSignals() {
            try {
                const data = await getTradingSignals(5);
                setSignals(data);
            }
            catch {
                // silently fail
            }
            finally {
                setLoading(false);
            }
        }
        fetchSignals();
        const interval = setInterval(fetchSignals, 60000);
        return () => clearInterval(interval);
    }, []);
    if (loading)
        return h('div', { class: 'widget-loading' }, 'Loading signals...');
    return h('div', { class: 'signals-widget' }, h('h3', null, '📊 Trading Signals'), h('div', { class: 'signals-list' }, signals.map((signal, i) => h('div', { key: i, class: 'signal-item' }, h('div', { class: 'signal-header' }, h('span', { class: 'signal-pair' }, signal.pair), h('span', { class: `signal-confidence signal-confidence-${signal.confidence}` }, `${Math.round(signal.confidence * 100)}% confidence`)), h('div', { class: 'signal-action', 'data-action': signal.action }, signal.action === 'buy' ? '🟢 BUY' : signal.action === 'sell' ? '🔴 SELL' : '⚪ HOLD'), h('div', { class: 'signal-reason' }, signal.reason)))));
}
function PortfolioWidget() {
    const [positions, setPositions] = useState([]);
    const [totalValue, setTotalValue] = useState(0);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        async function fetchPortfolio() {
            try {
                const data = await getPortfolio();
                setPositions(data.positions);
                setTotalValue(data.totalValueUsd);
            }
            catch {
                // silently fail
            }
            finally {
                setLoading(false);
            }
        }
        fetchPortfolio();
    }, []);
    if (loading)
        return h('div', { class: 'widget-loading' }, 'Loading portfolio...');
    const pnl = positions.reduce((sum, p) => sum + p.pnlUsd, 0);
    const pnlPercent = totalValue > 0 ? (pnl / (totalValue - pnl)) * 100 : 0;
    return h('div', { class: 'portfolio-widget' }, h('h3', null, '💼 Portfolio'), h('div', { class: 'portfolio-summary' }, h('div', { class: 'total-value' }, h('span', { class: 'label' }, 'Total Value'), h('span', { class: 'value' }, formatUsd(totalValue))), h('div', { class: `pnl ${pnl >= 0 ? 'positive' : 'negative'}` }, h('span', { class: 'label' }, 'P&L'), h('span', { class: 'value' }, `${pnl >= 0 ? '+' : ''}${formatUsd(pnl)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`))), h('div', { class: 'positions-list' }, positions.map((pos, i) => h('div', { key: i, class: 'position-item' }, h('span', { class: 'position-symbol' }, pos.symbol), h('span', { class: 'position-amount' }, `${formatNumber(pos.amount)} ${pos.symbol}`), h('span', { class: `position-pnl ${pos.pnlUsd >= 0 ? 'positive' : 'negative'}` }, `${pos.pnlUsd >= 0 ? '+' : ''}${formatUsd(pos.pnlUsd)}`)))));
}
function TradingWidget() {
    const [wallet, setWallet] = useState(null);
    const [connecting, setConnecting] = useState(false);
    const checkStatus = useCallback(async () => {
        const status = await checkWalletStatus();
        setWallet(status);
    }, []);
    useEffect(() => {
        checkStatus();
    }, [checkStatus]);
    async function handleConnect() {
        setConnecting(true);
        try {
            await connectWallet();
            await checkStatus();
        }
        catch (e) {
            console.error('Failed to connect wallet:', e);
        }
        finally {
            setConnecting(false);
        }
    }
    return h('div', { class: 'trading-widget' }, h('h3', null, '🚀 Trade'), wallet?.connected
        ? h('div', { class: 'wallet-info' }, h('span', { class: 'wallet-label' }, 'Connected:'), h('span', { class: 'wallet-address' }, formatAddress(wallet.address || '')))
        : h('button', {
            class: 'connect-btn',
            onClick: handleConnect,
            disabled: connecting
        }, connecting ? 'Connecting...' : 'Connect Wallet'));
}
function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    return h('div', { class: 'crypto-app' }, h('header', { class: 'crypto-header' }, h('div', { class: 'logo' }, h('span', { class: 'logo-icon' }, '⚡'), h('span', { class: 'logo-text' }, 'Ivee')), h('nav', { class: 'crypto-nav' }, h('button', { class: `nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`, onClick: () => setActiveTab('dashboard') }, 'Dashboard'), h('button', { class: `nav-btn ${activeTab === 'signals' ? 'active' : ''}`, onClick: () => setActiveTab('signals') }, 'Signals'), h('button', { class: `nav-btn ${activeTab === 'portfolio' ? 'active' : ''}`, onClick: () => setActiveTab('portfolio') }, 'Portfolio'), h('button', { class: `nav-btn ${activeTab === 'trade' ? 'active' : ''}`, onClick: () => setActiveTab('trade') }, 'Trade'))), h('main', { class: 'crypto-main' }, activeTab === 'dashboard' && h('div', { class: 'dashboard-grid' }, h('div', { class: 'panel' }, h(WhaleAlertsWidget)), h('div', { class: 'panel' }, h(TradingSignalsWidget)), h('div', { class: 'panel' }, h(PortfolioWidget))), activeTab === 'signals' && h('div', { class: 'panel panel-full' }, h(TradingSignalsWidget)), activeTab === 'portfolio' && h('div', { class: 'panel panel-full' }, h(PortfolioWidget)), activeTab === 'trade' && h('div', { class: 'panel panel-full' }, h(TradingWidget))));
}
render(h(App), document.getElementById('app'));
