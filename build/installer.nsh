!macro preInit
  StrCpy $LANGUAGE 1033
!macroend

!macro customInstall
  SetShellVarContext current
  CreateDirectory "$APPDATA\sudari"
  FileOpen $0 "$APPDATA\sudari\installer-language.txt" w
  FileWrite $0 "$LANGUAGE"
  FileClose $0
!macroend
