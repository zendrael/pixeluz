# Pressão da caneta

Com `pointerType === "pen"`, `PointerEvent.pressure` escala só o tamanho do pincel (`penFactor` em `paintSettings`). A opacidade fica em `session.brushOpacity`.

Motivo: pressão baixa (comum em S-Pen e trackpads) não deve apagar o traço. Quem quer traço translúcido mexe na opacidade da sessão.
