param(
    [Parameter(Mandatory = $true)][string]$CertificatePath,
    [Parameter(Mandatory = $true)][string]$ExpectedCnpj,
    [Security.SecureString]$Password
)

$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $CertificatePath).Path
$expected = $ExpectedCnpj -replace '\D', ''
if ($expected -notmatch '^\d{14}$') { throw 'CNPJ esperado inválido.' }
$ownedPassword = -not $PSBoundParameters.ContainsKey('Password')
if ($ownedPassword) { $Password = Read-Host 'Senha do certificado A1 (não será exibida nem salva)' -AsSecureString }
$certificates = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2Collection
try {
    $flags = [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
    # Windows PowerShell 5.1 exposes only the string-password Import overload.
    # Keep the temporary plaintext in this process, never in arguments, files or output.
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    try {
        $temporaryPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        $certificates.Import($resolved, $temporaryPassword, $flags)
    } finally {
        $temporaryPassword = $null
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    $leaf = $certificates | Where-Object { $_.HasPrivateKey } | Select-Object -First 1
    if (-not $leaf) { throw 'O arquivo não contém certificado com chave privada acessível.' }
    $cnpjMatches = $leaf.Subject -match "(?<!\d)$expected(?!\d)"
    $now = Get-Date
    $isCurrent = $leaf.NotBefore -le $now -and $leaf.NotAfter -gt $now
    $signatureWorks = $false
    $rsaPrivate = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($leaf)
    if ($rsaPrivate) {
        try {
            $sample = [Text.Encoding]::UTF8.GetBytes('mercado-do-vale-local-certificate-check')
            $signature = $rsaPrivate.SignData($sample, [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
            $rsaPublic = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPublicKey($leaf)
            try { $signatureWorks = $rsaPublic.VerifyData($sample, $signature, [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1) }
            finally { $rsaPublic.Dispose() }
        } finally { $rsaPrivate.Dispose() }
    }
    [pscustomobject]@{
        CnpjCorresponde = $cnpjMatches
        ValidoNestaData = $isCurrent
        ValidoAte = $leaf.NotAfter.ToString('yyyy-MM-dd')
        ChavePrivadaPresente = $leaf.HasPrivateKey
        AssinaturaLocalFuncionou = $signatureWorks
    } | Format-List
    if (-not ($cnpjMatches -and $isCurrent -and $signatureWorks)) { throw 'Falha na validação pública.' }
} catch {
    throw 'Não foi possível validar o A1. Confira a senha e a integridade do arquivo; nenhum segredo foi registrado.'
} finally {
    foreach ($certificate in $certificates) { $certificate.Dispose() }
    if ($ownedPassword) { $Password.Dispose() }
}
