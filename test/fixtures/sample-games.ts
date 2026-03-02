// Real chess.com PGN from user's game (correasam as Black, 18 moves, checkmate)
export const SAMPLE_PGN = `[Event "TheOne12131 vs correasam"]
[Site "Chess.com"]
[Date "2026-02-28"]
[White "TheOne12131"]
[Black "correasam"]
[Result "0-1"]
[WhiteElo "408"]
[BlackElo "461"]
[TimeControl "600"]
[Termination "correasam won by checkmate"]

1. e3 e5 2. e4 Nf6 3. Nc3 Nc6 4. Nf3 d5 5. d4 Bd6 6. exd5 Nxd5 7. Nxd5 Nxd4 8. Nxd4 Bc5 9. c3 Qxd5 10. Qa4+ c6 11. Nxc6 bxc6 12. Be2 Qxg2 13. Bf3 Qxf2+ 14. Kd1 Qxf3+ 15. Kc2 Bf5+ 16. Kb3 Rb8+ 17. Kc4 Qd3+ 18. Kxc5 Qd5# 0-1`;

// Same game with clock annotations (chess.com format)
export const SAMPLE_PGN_WITH_CLOCKS = `[Event "TheOne12131 vs correasam"]
[Site "Chess.com"]
[Date "2026-02-28"]
[White "TheOne12131"]
[Black "correasam"]
[Result "0-1"]
[WhiteElo "408"]
[BlackElo "461"]
[TimeControl "600"]
[Termination "correasam won by checkmate"]

1. e3 {[%clk 0:09:57.6]} e5 {[%clk 0:09:56.9]} 2. e4 {[%clk 0:09:51]} Nf6 {[%clk 0:09:50.3]} 3. Nc3 {[%clk 0:09:43.2]} Nc6 {[%clk 0:09:33.3]} 4. Nf3 {[%clk 0:09:35.6]} d5 {[%clk 0:09:23.1]} 5. d4 {[%clk 0:09:19.2]} Bd6 {[%clk 0:09:06]} 6. exd5 {[%clk 0:09:04.3]} Nxd5 {[%clk 0:08:50.2]} 7. Nxd5 {[%clk 0:08:46.1]} Nxd4 {[%clk 0:08:42.5]} 8. Nxd4 {[%clk 0:08:35.3]} Bc5 {[%clk 0:08:26.3]} 9. c3 {[%clk 0:08:31.6]} Qxd5 {[%clk 0:08:13.5]} 10. Qa4+ {[%clk 0:08:26.9]} c6 {[%clk 0:08:06.2]} 11. Nxc6 {[%clk 0:08:21.3]} bxc6 {[%clk 0:07:55]} 12. Be2 {[%clk 0:08:06.2]} Qxg2 {[%clk 0:07:36.3]} 13. Bf3 {[%clk 0:07:52.1]} Qxf2+ {[%clk 0:07:17.5]} 14. Kd1 {[%clk 0:07:38.2]} Qxf3+ {[%clk 0:07:03.1]} 15. Kc2 {[%clk 0:07:21.4]} Bf5+ {[%clk 0:06:57]} 16. Kb3 {[%clk 0:07:10.3]} Rb8+ {[%clk 0:06:42.9]} 17. Kc4 {[%clk 0:06:59.3]} Qd3+ {[%clk 0:06:17.3]} 18. Kxc5 {[%clk 0:06:53.2]} Qd5# {[%clk 0:05:44.5]} 0-1`;

// Short game — Scholar's mate, user as White
export const SHORT_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2025.01.01"]
[Round "-"]
[White "correasam"]
[Black "opponent123"]
[Result "1-0"]
[WhiteElo "500"]
[BlackElo "450"]
[TimeControl "300"]
[Termination "correasam won by checkmate"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`;

// Draw game
export const DRAW_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2025.03.10"]
[Round "-"]
[White "correasam"]
[Black "drawmaster"]
[Result "1/2-1/2"]
[WhiteElo "480"]
[BlackElo "490"]
[TimeControl "600"]
[Termination "Game drawn by agreement"]

1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d3 Nf6 1/2-1/2`;

// Same game as SAMPLE_PGN but all on one line (chess.com copy-paste format)
export const SINGLE_LINE_PGN = `[Event "TheOne12131 vs correasam"][Site "Chess.com"][Date "2026-02-28"][White "TheOne12131"][Black "correasam"][Result "0-1"][WhiteElo "408"][BlackElo "461"][TimeControl "600"][Termination "correasam won by checkmate"]1. e3 e5 2. e4 Nf6 3. Nc3 Nc6 4. Nf3 d5 5. d4 Bd6 6. exd5 Nxd5 7. Nxd5 Nxd4 8.Nxd4 Bc5 9. c3 Qxd5 10. Qa4+ c6 11. Nxc6 bxc6 12. Be2 Qxg2 13. Bf3 Qxf2+ 14. Kd1Qxf3+ 15. Kc2 Bf5+ 16. Kb3 Rb8+ 17. Kc4 Qd3+ 18. Kxc5 Qd5# 0-1`;

// PGN with eval annotations
export const EVAL_ANNOTATED_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2025.04.01"]
[Round "-"]
[White "correasam"]
[Black "evalguy"]
[Result "1-0"]
[WhiteElo "500"]
[BlackElo "480"]
[TimeControl "600"]
[Termination "correasam won by resignation"]

1. e4 {[%eval 0.2]} e5 {[%eval 0.1]} 2. Nf3 {[%eval 0.3]} Nc6 {[%eval 0.2]} 1-0`;
