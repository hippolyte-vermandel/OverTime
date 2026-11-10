// Pictogrammes maison des jeux (aucun logo officiel), tracés sur une grille de 24.
// La couleur vient des variables --jeu-<code> de app.css.
export const PICTOS = {
	lol: 'M12 3l7 3v6c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6z',
	valorant: 'M12 4v4M12 16v4M4 12h4M16 12h4M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
	rocket: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM4.5 10c3 1.5 12 1.5 15 0M6 17c2-3 10-3 12 0',
	fortnite: 'M4 11a8 8 0 0 1 16 0zM4 11l8 9 8-9M12 11v9',
	tft: 'M12 3l8 5v8l-8 5-8-5V8zM12 8v8M8 10l8 4M16 10l-8 4',
	cod: 'M6 4h12l1 5-7 11L5 9z',
	warzone: 'M4 20l8-16 8 16zM9 14h6',
	'2xko': 'M5 5h8v8H5zM11 11h8v8h-8z'
};

/** Chemin SVG du pictogramme d'un jeu (un losange neutre si le jeu est inconnu) */
export function picto(code) {
	return PICTOS[code] ?? 'M12 4l8 8-8 8-8-8z';
}
