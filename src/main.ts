import './style.css';
import { Game } from './core/Game';

const mount = document.querySelector<HTMLElement>('#app');
if (!mount) throw new Error('Missing #app mount element');

const game = new Game(mount);
game.start();
