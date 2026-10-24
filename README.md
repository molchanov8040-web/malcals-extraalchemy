# Malcal's ExtraAlchemy

Модуль алхимии для Foundry VTT 13.351 и системы D&D 5e.

## Установка и обновления через Foundry

В поле **Manifest URL** в окне **Install Module** Foundry укажите именно этот адрес:

```text
https://raw.githubusercontent.com/molchanov8040-web/malcals-extraalchemy/main/module.json
```

Не используйте адрес страницы GitHub вида `https://github.com/.../blob/main/module.json`: это HTML-страница, а не JSON-манифест, поэтому Foundry показывает ошибку `No module manifest found`.

После первой установки через правильный Manifest URL Foundry сохранит адрес из поля `manifest` в `module.json` и сможет проверять обновления в окне **Configuration and Setup → Add-on Modules → Update All**.

## Разработка

Исходники располагаются в ветке `main`. Поле `download` указывает на ZIP-архив этой ветки. Перед каждым релизом меняйте поле `version` в `module.json`.
