# Atualizações do firmware

Preferência do usuário: ao alterar o firmware ou seu protocolo com o painel,
atualizar a versão em `codigoESP.INO` (cabeçalho e `FIRMWARE_VERSION`), compilar
e gravar o firmware atualizado no ESP32 quando a placa estiver conectada e
identificada. Não confundir atualização do arquivo com gravação na placa.
Informar explicitamente quando a gravação não foi possível. Preservar alterações
existentes e verificar o resultado da gravação antes de afirmar que foi atualizado.

O firmware também deve ser mantido sincronizado em
`../RiscoDeQuedaALERTA/RiscoDeQuedaALERTA.ino`. Depois de qualquer alteração em
`codigoESP.INO`, copie o conteúdo atualizado para esse arquivo antes de compilar
ou gravar a placa.
