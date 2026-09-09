from pathlib import Path
import json
langs=['en','ko','ja','zh-CN','zh-TW','es','fr','de','pt-BR','it','ru','ar']
names=['English','한국어','日本語','简体中文','繁體中文','Español','Français','Deutsch','Português (Brasil)','Italiano','Русский','العربية']
data='''
pinHint|A note that stays beside your otter. Leave blank to hide.|수달 곁에 계속 띄워 둘 메모예요. 비우면 사라져요.|カワウソのそばに表示するメモです。空欄にすると非表示になります。|一直显示在水獭身旁的便签。留空即可隐藏。|一直顯示在水獺身旁的便箋。留空即可隱藏。|Una nota junto a tu nutria. Déjala vacía para ocultarla.|Une note près de votre loutre. Laissez vide pour la masquer.|Eine Notiz neben deinem Otter. Zum Ausblenden leer lassen.|Uma nota ao lado da sua lontra. Deixe em branco para ocultar.|Una nota accanto alla tua lontra. Lascia vuoto per nasconderla.|Заметка рядом с выдрой. Оставьте поле пустым, чтобы скрыть её.|ملاحظة تبقى بجانب قضاعتك. اترك الحقل فارغًا لإخفائها.
settings|Settings|설정|設定|设置|設定|Ajustes|Réglages|Einstellungen|Configurações|Impostazioni|Настройки|الإعدادات
language|Language|언어|言語|语言|語言|Idioma|Langue|Sprache|Idioma|Lingua|Язык|اللغة
welcome|A little otter. A little better day.|작은 수달과, 조금 더 좋은 하루.|小さなカワウソと、ちょっといい一日。|小小水獭，让每一天更美好。|小小水獺，讓每一天更美好。|Una pequeña nutria para alegrar tu día.|Une petite loutre pour une belle journée.|Ein kleiner Otter für einen schöneren Tag.|Uma pequena lontra para alegrar seu dia.|Una piccola lontra per una giornata migliore.|Маленькая выдра для хорошего дня.|قضاعة صغيرة ليوم أجمل.
choose|Choose your language|사용할 언어를 골라 주세요|言語を選んでください|请选择语言|請選擇語言|Elige tu idioma|Choisissez votre langue|Wähle deine Sprache|Escolha seu idioma|Scegli la tua lingua|Выберите язык|اختر لغتك
languageHint|You can change this anytime in Settings.|설정에서 언제든 바꿀 수 있어요.|設定でいつでも変更できます。|可随时在设置中更改。|可隨時在設定中更改。|Puedes cambiarlo en Ajustes.|Modifiable à tout moment dans les réglages.|Jederzeit in den Einstellungen änderbar.|Você pode mudar nas configurações.|Puoi cambiarla nelle impostazioni.|Можно изменить в настройках.|يمكنك تغييرها من الإعدادات في أي وقت.
meet|Meet Sudari|수다리 만나기|スダリに会う|认识 Sudari|認識 Sudari|Conocer a Sudari|Rencontrer Sudari|Sudari kennenlernen|Conhecer Sudari|Incontra Sudari|Знакомство с Sudari|تعرّف على Sudari
appearance|Your otter|내 수달|あなたのカワウソ|我的水獭|我的水獺|Tu nutria|Votre loutre|Dein Otter|Sua lontra|La tua lontra|Ваша выдра|قضاعتك
name|Your name|불러줄 이름|呼んでほしい名前|你的名字|你的名字|Tu nombre|Votre prénom|Dein Name|Seu nome|Il tuo nome|Ваше имя|اسمك
nameHint|What should I call you?|어떻게 불러줄까요?|なんて呼べばいい？|我该怎么称呼你？|我該怎麼稱呼你？|¿Cómo te llamo?|Comment vous appeler ?|Wie soll ich dich nennen?|Como devo te chamar?|Come ti chiamo?|Как вас называть?|بماذا أناديك؟
color|Fur color|털 색|毛色|毛色|毛色|Color del pelaje|Couleur du pelage|Fellfarbe|Cor do pelo|Colore del pelo|Цвет шерсти|لون الفراء
pattern|Pattern|무늬|模様|花纹|花紋|Patrón|Motif|Muster|Padrão|Motivo|Узор|النقش
plain|Plain|민무늬|無地|纯色|純色|Liso|Uni|Einfarbig|Liso|Tinta unita|Однотонный|سادة
spots|Spots|점박이|ぶち|斑点|斑點|Manchas|Taches|Flecken|Manchas|Macchie|Пятна|بقع
stripes|Stripes|줄무늬|しま|条纹|條紋|Rayas|Rayures|Streifen|Listras|Strisce|Полосы|خطوط
blaze|Forehead patch|이마 무늬|額の模様|额头花纹|額頭花紋|Mancha en la frente|Tache sur le front|Stirnfleck|Mancha na testa|Macchia sulla fronte|Пятно на лбу|بقعة على الجبهة
size|Size|크기|大きさ|大小|大小|Tamaño|Taille|Größe|Tamanho|Dimensione|Размер|الحجم
fitHint|Automatically fits smaller screens to keep everything visible.|작은 화면에서는 잘리지 않도록 크기를 자동 조정해요.|小さな画面では全体が見えるよう自動調整します。|小屏幕会自动调整大小，确保完整显示。|小螢幕會自動調整大小，確保完整顯示。|Se adapta a pantallas pequeñas para mostrarlo todo.|S'adapte aux petits écrans pour tout afficher.|Passt sich kleinen Bildschirmen an, damit alles sichtbar bleibt.|Ajusta-se a telas menores para manter tudo visível.|Si adatta agli schermi piccoli per mostrare tutto.|Подстраивается под маленькие экраны, чтобы всё было видно.|يتكيف مع الشاشات الصغيرة ليبقى كل شيء ظاهرًا.
reactions|Reactions & sound|반응과 소리|反応と音|互动与声音|互動與聲音|Reacciones y sonido|Réactions et son|Reaktionen & Ton|Reações e som|Reazioni e suoni|Реакции и звук|التفاعل والصوت
mouse|Follow the cursor|커서 따라보기|カーソルを追う|跟随光标|跟隨游標|Seguir el cursor|Suivre le curseur|Mauszeiger verfolgen|Seguir o cursor|Segui il cursore|Следить за курсором|تتبّع المؤشر
keyboard|React to typing|타이핑에 반응|タイピングに反応|打字互动|打字互動|Reaccionar al escribir|Réagir à la frappe|Auf Tippen reagieren|Reagir à digitação|Reagisci alla digitazione|Реагировать на печать|التفاعل مع الكتابة
scroll|Crack shells while scrolling|스크롤하면 조개 까기|スクロールで貝割り|滚动时开贝壳|捲動時開貝殼|Abrir conchas al desplazar|Ouvrir des coquillages au défilement|Muscheln beim Scrollen knacken|Abrir conchas ao rolar|Apri conchiglie scorrendo|Открывать ракушки при прокрутке|فتح الأصداف عند التمرير
pet|Head pats|머리 쓰다듬기|頭をなでる|摸摸头|摸摸頭|Caricias|Caresses|Kopf streicheln|Carinho na cabeça|Carezze sulla testa|Поглаживания|مداعبة الرأس
volume|Volume|소리 크기|音量|音量|音量|Volumen|Volume|Lautstärke|Volume|Volume|Громкость|مستوى الصوت
muted|Mute|음소거|ミュート|静音|靜音|Silenciar|Couper le son|Stumm|Silenciar|Silenzia|Без звука|كتم الصوت
sleep|Nap after|잠들기까지|お昼寝まで|多久后睡觉|多久後睡覺|Siesta después de|Sieste après|Schlafen nach|Dormir após|Sonnellino dopo|Сон через|قيلولة بعد
minutes|min|분|分|分|分|min|min|Min.|min|min|мин|دقيقة
rounds|Rounds|반복|セット|轮数|輪數|Rondas|Cycles|Runden|Rodadas|Cicli|Раунды|الجولات
reminders|Gentle reminders|다정한 알림|やさしいリマインダー|贴心提醒|貼心提醒|Recordatorios amables|Petits rappels|Sanfte Erinnerungen|Lembretes gentis|Promemoria gentili|Заботливые напоминания|تذكيرات لطيفة
stretch|Stretch|스트레칭|ストレッチ|伸展|伸展|Estirar|S'étirer|Dehnen|Alongar|Stretching|Разминка|التمدد
water|Drink water|물 마시기|水を飲む|喝水|喝水|Beber agua|Boire de l'eau|Wasser trinken|Beber água|Bere acqua|Выпить воды|شرب الماء
interval|Every|주기|間隔|间隔|間隔|Cada|Toutes les|Alle|A cada|Ogni|Каждые|كل
meals|Mealtimes|식사 시간|ごはんの時間|用餐时间|用餐時間|Comidas|Repas|Essenszeiten|Refeições|Pasti|Время еды|أوقات الطعام
breakfast|Breakfast|아침|朝ごはん|早餐|早餐|Desayuno|Petit-déjeuner|Frühstück|Café da manhã|Colazione|Завтрак|الإفطار
lunch|Lunch|점심|昼ごはん|午餐|午餐|Almuerzo|Déjeuner|Mittagessen|Almoço|Pranzo|Обед|الغداء
dinner|Dinner|저녁|晩ごはん|晚餐|晚餐|Cena|Dîner|Abendessen|Jantar|Cena|Ужин|العشاء
mealHint|Leave a time empty to skip that reminder.|시간을 비우면 해당 식사는 알리지 않아요.|時刻を空欄にすると通知しません。|留空则不提醒该餐。|留空則不提醒該餐。|Deja la hora vacía para omitir el aviso.|Laissez l'heure vide pour désactiver ce rappel.|Zeit leer lassen, um die Erinnerung auszuschalten.|Deixe o horário vazio para desativar o lembrete.|Lascia l'orario vuoto per disattivare l'avviso.|Оставьте время пустым, чтобы отключить напоминание.|اترك الوقت فارغًا لتخطي التذكير.
affection|Little words of love|가끔 마음 전하기|ときどき愛情表現|偶尔说点暖心话|偶爾說點暖心話|Pequeñas palabras de cariño|Petits mots doux|Kleine Liebesbotschaften|Pequenas palavras de carinho|Piccole parole d'affetto|Тёплые слова|كلمات محبة صغيرة
ambient|Play on my own|심심하면 혼자 놀기|ひとり遊び|自己玩耍|自己玩耍|Jugar por mi cuenta|Jouer tout seul|Alleine spielen|Brincar sozinho|Giocare da solo|Играть самостоятельно|اللعب بمفردي
timer|Shell focus timer|조개 집중 타이머|貝がら集中タイマー|贝壳专注计时器|貝殼專注計時器|Temporizador de concha|Minuteur coquillage|Muschel-Fokustimer|Temporizador de concha|Timer conchiglia|Таймер-ракушка|مؤقت التركيز الصدفي
focus|Focus|집중|集中|专注|專注|Enfoque|Concentration|Fokus|Foco|Concentrazione|Фокус|تركيز
break|Break|휴식|休憩|休息|休息|Descanso|Pause|Pause|Pausa|Pausa|Отдых|استراحة
start|Start|시작|スタート|开始|開始|Iniciar|Démarrer|Starten|Iniciar|Avvia|Начать|ابدأ
restart|Restart|다시 시작|やり直す|重新开始|重新開始|Reiniciar|Recommencer|Neu starten|Reiniciar|Riavvia|Заново|ابدأ من جديد
stop|Stop|중단|停止|停止|停止|Detener|Arrêter|Stoppen|Parar|Ferma|Остановить|إيقاف
close|Close|닫기|閉じる|关闭|關閉|Cerrar|Fermer|Schließen|Fechar|Chiudi|Закрыть|إغلاق
reset|Reset settings|설정 초기화|設定をリセット|重置设置|重設設定|Restablecer ajustes|Réinitialiser|Zurücksetzen|Redefinir ajustes|Ripristina impostazioni|Сбросить настройки|إعادة ضبط الإعدادات
resetConfirm|Reset preferences? Your language will be kept.|설정을 초기화할까요? 언어는 유지돼요.|設定を初期化しますか？言語は保持されます。|重置设置？将保留语言。|重設設定？將保留語言。|¿Restablecer ajustes? Se conservará el idioma.|Réinitialiser ? La langue sera conservée.|Zurücksetzen? Die Sprache bleibt erhalten.|Redefinir? O idioma será mantido.|Ripristinare? La lingua verrà mantenuta.|Сбросить настройки? Язык сохранится.|إعادة الضبط؟ سيتم الاحتفاظ باللغة.
messages|Notes & reminders|메모와 시간 알림|メモと時刻通知|便签与提醒|便箋與提醒|Notas y avisos|Notes et rappels|Notizen & Erinnerungen|Notas e lembretes|Note e promemoria|Заметки и напоминания|الملاحظات والتذكيرات
pin|Pinned note|고정 메모|固定メモ|置顶便签|置頂便箋|Nota fija|Note épinglée|Angeheftete Notiz|Nota fixada|Nota fissa|Закреплённая заметка|ملاحظة مثبتة
reminderText|Reminder message|알림 내용|通知メッセージ|提醒内容|提醒內容|Mensaje del aviso|Message du rappel|Erinnerungstext|Mensagem do lembrete|Messaggio del promemoria|Текст напоминания|نص التذكير
add|Add|추가|追加|添加|新增|Añadir|Ajouter|Hinzufügen|Adicionar|Aggiungi|Добавить|إضافة
remove|Remove|삭제|削除|删除|刪除|Eliminar|Supprimer|Entfernen|Remover|Rimuovi|Удалить|إزالة
system|Desktop|데스크톱|デスクトップ|桌面|桌面|Escritorio|Bureau|Desktop|Área de trabalho|Scrivania|Рабочий стол|سطح المكتب
launchAtLogin|Open at login|로그인 시 자동 실행|ログイン時に起動|登录时启动|登入時啟動|Abrir al iniciar sesión|Ouvrir à la connexion|Bei Anmeldung starten|Abrir ao iniciar sessão|Apri all'accesso|Запускать при входе|فتح عند تسجيل الدخول
peek|Peek mode|빼꼼 모드|ひょっこりモード|探头模式|探頭模式|Modo asomado|Mode coucou|Hervorlugen|Modo espiar|Modalità cucù|Выглядывать с края|وضع الإطلالة
help|Help & AI integration|사용법과 AI 연동|使い方とAI連携|帮助与 AI 联动|說明與 AI 整合|Ayuda e integración IA|Aide et intégration IA|Hilfe & KI-Anbindung|Ajuda e integração IA|Aiuto e integrazione IA|Помощь и интеграция ИИ|المساعدة وربط الذكاء الاصطناعي
quit|Quit Sudari|수다리 종료|スダリを終了|退出 Sudari|結束 Sudari|Salir de Sudari|Quitter Sudari|Sudari beenden|Sair do Sudari|Esci da Sudari|Выйти из Sudari|إنهاء Sudari
permission|Enable keyboard & scroll reactions|키보드·스크롤 반응 허용|キーボード・スクロール反応を許可|启用键盘与滚动互动|啟用鍵盤與捲動互動|Activar reacciones de teclado y desplazamiento|Activer les réactions clavier et défilement|Tastatur- und Scrollreaktionen aktivieren|Ativar reações ao teclado e rolagem|Attiva reazioni a tastiera e scorrimento|Включить реакции на клавиатуру и прокрутку|تفعيل تفاعل لوحة المفاتيح والتمرير
permissionHint|Allow Sudari in system privacy settings, then restart the app.|시스템 개인정보 설정에서 Sudari를 허용하고 다시 켜 주세요.|システムのプライバシー設定でSudariを許可し、再起動してください。|请在系统隐私设置中允许 Sudari，然后重启应用。|請在系統隱私設定中允許 Sudari，然後重新啟動。|Permite Sudari en la privacidad del sistema y reinícialo.|Autorisez Sudari dans les réglages de confidentialité puis redémarrez.|Erlaube Sudari in den Datenschutzeinstellungen und starte es neu.|Permita Sudari na privacidade do sistema e reinicie o app.|Autorizza Sudari nelle impostazioni privacy e riavvia l'app.|Разрешите Sudari в настройках конфиденциальности и перезапустите.|اسمح لـ Sudari في إعدادات الخصوصية ثم أعد تشغيل التطبيق.
wave|Say hello|인사해줘|あいさつ|打个招呼|打個招呼|Saludar|Dire bonjour|Hallo sagen|Dar um oi|Saluta|Поздороваться|إلقاء التحية
love|A little love|사랑한다고 해줘|愛情を伝える|说点暖心话|說點暖心話|Un poco de cariño|Un peu d'amour|Ein bisschen Liebe|Um pouco de carinho|Un po' d'affetto|Немного тепла|قليل من المحبة
snack|Give a shrimp|새우 주기|エビをあげる|喂小虾|餵小蝦|Dar una gamba|Donner une crevette|Garnele geben|Dar um camarão|Dai un gamberetto|Дать креветку|تقديم روبيانة
crack|Crack a shell|조개 까기|貝を割る|开贝壳|開貝殼|Abrir una concha|Ouvrir un coquillage|Muschel knacken|Abrir uma concha|Apri una conchiglia|Открыть ракушку|فتح صدفة
fireworks|Celebrate|축하 폭죽|お祝い|庆祝烟花|慶祝煙火|Celebrar|Fêter|Feiern|Comemorar|Festeggia|Праздновать|احتفال
float|Swim together|같이 헤엄치기|いっしょに泳ぐ|一起游泳|一起游泳|Nadar juntos|Nager ensemble|Zusammen schwimmen|Nadar juntos|Nuotiamo insieme|Поплавать вместе|نسبح معًا
saved|Changes saved automatically|변경 사항이 자동 저장돼요|変更は自動保存されます|更改已自动保存|變更會自動儲存|Los cambios se guardan solos|Modifications enregistrées automatiquement|Änderungen werden automatisch gespeichert|Alterações salvas automaticamente|Modifiche salvate automaticamente|Изменения сохраняются автоматически|تُحفظ التغييرات تلقائيًا
hello|Hello, {name}!|안녕, {name}!|こんにちは、{name}！|你好，{name}！|你好，{name}！|¡Hola, {name}!|Bonjour, {name} !|Hallo, {name}!|Olá, {name}!|Ciao, {name}!|Привет, {name}!|مرحبًا، {name}!
done|All done, {name}!|다 끝났어, {name}!|終わったよ、{name}！|完成啦，{name}！|完成啦，{name}！|¡Todo listo, {name}!|C'est terminé, {name} !|Alles fertig, {name}!|Tudo pronto, {name}!|Tutto fatto, {name}!|Готово, {name}!|انتهينا، {name}!
congrats|You did it, {name}!|해냈어, {name}!|できたね、{name}！|你做到了，{name}！|你做到了，{name}！|¡Lo lograste, {name}!|Tu as réussi, {name} !|Geschafft, {name}!|Você conseguiu, {name}!|Ce l'hai fatta, {name}!|Получилось, {name}!|لقد نجحت، {name}!
dragLine|Wheee, I'm stretching!|으앙, 늘어난다!|わあ、のびる〜！|哇，我拉长啦！|哇，我拉長啦！|¡Uy, me estiro!|Ouh, je m'étire !|Hui, ich werde lang!|Uau, estou esticando!|Uiii, mi allungo!|Ой, я растягиваюсь!|ويي، أنا أتمدد!
floatLine|Just floating…|둥둥…|ぷかぷか…|漂呀漂…|漂呀漂…|Flotando…|Je flotte…|Einfach treiben…|Flutuando…|Galleggiando…|Плыву-плыву…|أطفو بهدوء…
snackLine|A shrimp! Thank you, {name}!|새우다! 고마워, {name}!|エビだ！ありがとう、{name}！|是小虾！谢谢你，{name}！|是小蝦！謝謝你，{name}！|¡Una gamba! ¡Gracias, {name}!|Une crevette ! Merci, {name} !|Eine Garnele! Danke, {name}!|Um camarão! Obrigado, {name}!|Un gamberetto! Grazie, {name}!|Креветка! Спасибо, {name}!|روبيانة! شكرًا، {name}!
stretchLine|Let's have a big stretch, {name}!|같이 쭈욱 스트레칭 하자, {name}!|いっしょにのびよう、{name}！|一起伸个懒腰吧，{name}！|一起伸個懶腰吧，{name}！|¡Vamos a estirarnos, {name}!|On s'étire, {name} !|Strecken wir uns, {name}!|Vamos nos alongar, {name}!|Facciamo stretching, {name}!|Давай разомнёмся, {name}!|لنتمدد قليلًا، {name}!
waterLine|Time for a sip of water!|물 한 모금 마실 시간이야!|お水をひとくち飲もう！|该喝口水啦！|該喝口水啦！|¡Hora de beber agua!|Une petite gorgée d'eau !|Zeit für einen Schluck Wasser!|Hora de beber água!|È ora di bere un po' d'acqua!|Пора выпить воды!|حان وقت شرب الماء!
focusLine|Focus time. I'll stay beside you.|집중 시간! 옆에 있을게.|集中の時間。そばにいるよ。|专注时间到，我会陪着你。|專注時間到，我會陪著你。|Hora de concentrarse. Estoy a tu lado.|On se concentre. Je reste à tes côtés.|Fokuszeit. Ich bleibe bei dir.|Hora de focar. Vou ficar ao seu lado.|È ora di concentrarsi. Resto con te.|Время сосредоточиться. Я рядом.|وقت التركيز. سأبقى بجانبك.
breakLine|Take a break. Float with me!|잠깐 쉬자. 나랑 둥둥 떠 있어!|ひと休み。いっしょにぷかぷか！|休息一下，和我一起漂着吧！|休息一下，和我一起漂著吧！|¡Descansa y flota conmigo!|Une pause. Viens flotter avec moi !|Mach Pause. Treib mit mir!|Descanse. Flutue comigo!|Fai una pausa. Galleggia con me!|Отдохни. Поплавай со мной!|خذ استراحة. اطفُ معي!
roundLine|Time for round {round}!|{round}번째 집중 시작!|{round}セット目、スタート！|第 {round} 轮开始啦！|第 {round} 輪開始啦！|¡Empieza la ronda {round}!|C'est parti pour le cycle {round} !|Zeit für Runde {round}!|Hora da rodada {round}!|È il momento del ciclo {round}!|Начинаем раунд {round}!|حان وقت الجولة {round}!
stoppedLine|Timer stopped. I'm still here.|타이머 멈췄어. 난 여기 있을게.|タイマー停止。ここにいるよ。|计时已停止，我还在这里。|計時已停止，我還在這裡。|Temporizador detenido. Sigo aquí.|Minuteur arrêté. Je reste ici.|Timer gestoppt. Ich bin noch da.|Temporizador parado. Continuo aqui.|Timer fermato. Sono ancora qui.|Таймер остановлен. Я всё ещё рядом.|توقف المؤقت. ما زلت هنا.
reminderLine|A little reminder!|알림이 왔어!|お知らせだよ！|小提醒来啦！|小提醒來啦！|¡Un recordatorio!|Un petit rappel !|Eine kleine Erinnerung!|Um lembrete!|Un piccolo promemoria!|Небольшое напоминание!|تذكير صغير!
tail1|Hey, not my tail!|야! 꼬리는 안 돼!|あっ、しっぽはだめ！|嘿，别拉尾巴！|嘿，別拉尾巴！|¡Eh, mi cola no!|Hé, pas ma queue !|Hey, nicht mein Schwanz!|Ei, não puxe meu rabo!|Ehi, non la coda!|Эй, не трогай хвост!|مهلًا، لا تلمس ذيلي!
tail2|Ouch! That's attached to me!|아야! 그거 내 꼬리야!|いたっ！ぼくのしっぽだよ！|哎呀，那是我的尾巴！|哎呀，那是我的尾巴！|¡Ay! ¡Es parte de mí!|Aïe ! Ça fait partie de moi !|Aua! Der gehört zu mir!|Ai! Isso faz parte de mim!|Ahi! È attaccata a me!|Ай! Это часть меня!|آخ! إنه جزء مني!
sulk|Hmph. I need a moment.|흥. 잠깐 삐져 있을래.|ふん。ちょっとすねちゃう。|哼，我要生一会儿闷气。|哼，我要生一會兒悶氣。|Hum. Necesito un momento.|Hmpf. Je boude un peu.|Hmpf. Ich brauche einen Moment.|Hum. Preciso de um momento.|Uff. Mi serve un momento.|Хмпф. Мне нужна минутка.|همف. أحتاج لحظة.
nameLine|Tell me your name in Settings!|설정에서 이름을 알려주면 불러줄게!|設定で名前を教えてね！|在设置里告诉我你的名字吧！|在設定裡告訴我你的名字吧！|¡Dime tu nombre en Ajustes!|Dis-moi ton prénom dans les réglages !|Verrate mir deinen Namen in den Einstellungen!|Me diga seu nome nas configurações!|Dimmi il tuo nome nelle impostazioni!|Укажи своё имя в настройках!|أخبرني باسمك في الإعدادات!
love1|Love you, {name}!|사랑해, {name}!|大好きだよ、{name}！|喜欢你，{name}！|喜歡你，{name}！|¡Te quiero, {name}!|Je t'aime, {name} !|Hab dich lieb, {name}!|Gosto de você, {name}!|Ti voglio bene, {name}!|Люблю тебя, {name}!|أحبك، {name}!
love2|I'll be beside you today, too.|오늘도 옆에 있을게.|今日もそばにいるよ。|今天也会陪着你。|今天也會陪著你。|Hoy también estaré a tu lado.|Aujourd'hui aussi, je reste près de toi.|Auch heute bleibe ich bei dir.|Hoje também ficarei ao seu lado.|Anche oggi sarò al tuo fianco.|И сегодня я буду рядом.|سأبقى بجانبك اليوم أيضًا.
love3|You're doing great, {name}.|잘하고 있어, {name}.|がんばってるね、{name}。|你做得很好，{name}。|你做得很好，{name}。|Lo estás haciendo genial, {name}.|Tu t'en sors très bien, {name}.|Du machst das toll, {name}.|Você está indo muito bem, {name}.|Stai andando alla grande, {name}.|Ты отлично справляешься, {name}.|أنت تبلي بلاءً حسنًا، {name}.
love4|One small step at a time.|한 번에 한 걸음씩 가자.|一歩ずつ進もう。|一步一步慢慢来。|一步一步慢慢來。|Un pasito a la vez.|Un petit pas à la fois.|Ein kleiner Schritt nach dem anderen.|Um passinho de cada vez.|Un piccolo passo alla volta.|По одному маленькому шагу.|خطوة صغيرة في كل مرة.
love5|Want half of my shell?|조개 반 나눠줄까?|貝がら半分あげようか？|要分你半个贝壳吗？|要分你半個貝殼嗎？|¿Quieres la mitad de mi concha?|Tu veux la moitié de mon coquillage ?|Magst du die Hälfte meiner Muschel?|Quer metade da minha concha?|Vuoi metà della mia conchiglia?|Хочешь половинку моей ракушки?|هل تريد نصف صدفتي؟
love6|You've worked hard. Rest a little.|고생했어. 조금 쉬어도 돼.|おつかれさま。少し休んでいいよ。|辛苦啦，休息一会儿吧。|辛苦啦，休息一會兒吧。|Has trabajado mucho. Descansa un poco.|Tu as bien travaillé. Repose-toi un peu.|Du hast viel geschafft. Ruh dich etwas aus.|Você se esforçou. Descanse um pouco.|Hai lavorato tanto. Riposati un po'.|Ты много работал. Немного отдохни.|لقد عملت بجد. استرح قليلًا.
mealLine|Let's get something to eat, {name}!|밥 먹으러 가자, {name}!|ごはんにしよう、{name}！|去吃点东西吧，{name}！|去吃點東西吧，{name}！|¡Vamos a comer, {name}!|Allons manger, {name} !|Lass uns etwas essen, {name}!|Vamos comer, {name}!|Andiamo a mangiare, {name}!|Давай поедим, {name}!|لنأكل شيئًا، {name}!
peekLine|Peeking… I'll give you some room.|빼꼼… 공간을 비워줄게.|ひょこっ…場所をあけるね。|探个头…给你留点空间。|探個頭…給你留點空間。|Me asomo… te dejo espacio.|Coucou… je te laisse de la place.|Kuckuck… ich mache dir Platz.|Espiando… vou dar espaço.|Cucù… ti lascio un po' di spazio.|Выглядываю… освобожу тебе место.|إطلالة صغيرة… سأترك لك مساحة.
shakeLine|Whoaaa, dizzy otter!|으아, 어질어질해!|わわ、目が回る〜！|哇，头好晕！|哇，頭好暈！|¡Uuuy, qué mareo!|Ouh là, ça tourne !|Hui, mir wird schwindelig!|Uau, fiquei tonto!|Uuuh, che giramento!|Ого, голова кружится!|واو، أشعر بالدوار!
fastLine|So fast! My paws are warming up!|너무 빨라! 앞발이 뜨거워져!|速いね！おててが熱くなる！|太快啦！小爪子都热起来了！|太快啦！小爪子都熱起來了！|¡Qué rápido! ¡Mis patitas se calientan!|Si vite ! Mes pattes chauffent !|So schnell! Meine Pfoten werden warm!|Muito rápido! Minhas patinhas esquentaram!|Che velocità! Mi si scaldano le zampette!|Как быстро! Лапки нагреваются!|سريع جدًا! كفوفي تسخن!
crackedLine|A little pearl for you!|작은 진주 하나, 너 줄게!|小さな真珠、あげるね！|送你一颗小珍珠！|送你一顆小珍珠！|¡Una perlita para ti!|Une petite perle pour toi !|Eine kleine Perle für dich!|Uma pérola para você!|Una piccola perla per te!|Маленькая жемчужина для тебя!|لؤلؤة صغيرة لك!
petLine|That's the spot…|거기 좋아…|そこ、気持ちいい…|就是那里，好舒服…|就是那裡，好舒服…|Ahí, justo ahí…|Oui, juste là…|Genau da…|É aí mesmo…|Sì, proprio lì…|Вот тут хорошо…|نعم، هنا بالضبط…
'''
result={l:{} for l in langs}
for line in data.strip().splitlines():
    parts=line.split('|'); assert len(parts)==13,(len(parts),parts[0])
    for i,l in enumerate(langs): result[l][parts[0]]=parts[i+1]
obj={'languages':[{'id':l,'name':n,'dir':'rtl' if l=='ar' else 'ltr'} for l,n in zip(langs,names)],'messages':result}
Path('renderer/locales.js').write_text('(function(g){var data='+json.dumps(obj,ensure_ascii=False,indent=2)+';if(typeof module==="object"&&module.exports)module.exports=data;else g.SudariLocales=data;})(typeof window==="object"?window:globalThis);\n',encoding='utf-8')
print(len(result['en']),'messages x',len(langs),'languages')
