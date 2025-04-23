import { Builder, By, Key } from 'selenium-webdriver'
import firefox from 'selenium-webdriver/firefox.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import fs from 'fs'
// Remover import do @electron/remote e usar require

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Define download path
const pathToDownload = path.join(__dirname, 'outputs')

// Define a new instance of firefox with specific options
const options = new firefox.Options()
options.setPreference('browser.download.folderList', 2) // use specific folder
options.setPreference('browser.download.dir', pathToDownload) // Set path to download
options.setPreference('browser.helperApps.alwaysAsk.force', false) // Do not ask anything (no pop up)
options.setPreference('browser.download.manager.showWhenStarting', false) // Do not show anything (no pop up)
options.setPreference('browser.helperApps.neverAsk.saveToDisk', 'application/zip') // MIME type for zip
options.setBinary('/snap/firefox/current/usr/lib/firefox/firefox')
console.log('[INFO] Preferences: OK')

// Define a new firefox instance
const driver = new Builder().forBrowser('firefox').setFirefoxOptions(options).build()
const width = 800
const height = 800

// Substituir toda esta parte
driver.manage().window().setRect({ width, height })
console.log('[INFO] Firefox: opened OK')

const lattes_ids = {
  'A. Misson': '4020121129398235',
  César: '9086857312391080',
  Chang: '1989662459244838',
  'Daniel Bonotto': '7430102726026121',
  Dionísio: '2302002033171923',
  George: '4074004628758766',
  Giancarlo: '7492100028914726',
  Guillermo: '8837180892948207',
  'J. Alexandre': '1994317879078816',
  'J.E. Zaine': '5491545942075288',
  Lucas: '1333845337012256',
  'Lucas Furlan': '9813790962724241',
  Matheus: '6025086815170993',
  Regiane: '9167526003742435',
  'R.J. Bertini': '3157052111423047',
  'Rodrigo Cerri': '0791368504458365',
  'Rodrigo Prudente': '0360977622257152',
  Rosemarie: '8936275161197131',
  Sergio: '1876676856135412',
  Washington: '3505628102830588',
}

// Define default URL
// const lattesUrl = 'http://buscatextual.cnpq.br/buscatextual/download.do?metodo=apresentar&idcnpq='
const lattesUrl = 'https://lattes.cnpq.br/'

async function waitForSubmitButton(driver, timeout = 300000) {
  console.log('[INFO] Aguardando resolução manual do captcha...')
  const button = await driver.findElement(By.id('submitBtn'))

  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    if (await button.isEnabled()) {
      console.log('[INFO] Captcha resolvido com sucesso!')
      return button
    }
    await driver.sleep(1000)
  }
  throw new Error('Timeout aguardando resolução do captcha')
}

async function savePageHTML(driver, idcnpq) {
  const html = await driver.getPageSource()
  const filePath = path.join(pathToDownload, `lattes_${idcnpq}.html`)
  fs.writeFileSync(filePath, html, 'utf8')
  return filePath
}

async function checkFileExists(idcnpq) {
  const htmlPath = path.join(pathToDownload, `lattes_${idcnpq}.html`)
  return fs.existsSync(htmlPath)
}

;(async function main() {
  try {
    for (const idcnpq of Object(lattes_ids).values) {
      // Verifica se o arquivo já existe
      if (await checkFileExists(idcnpq)) {
        console.log(`[INFO] Arquivo para ${idcnpq} já existe. Pulando...`)
        continue
      }

      const location = lattesUrl + idcnpq
      await driver.get(location)
      console.log('[INFO] Firefox: page loaded OK')

      // Find iframe tag and switch to that iframe context
      const frames = await driver.findElements(By.css('iframe'))
      await driver.switchTo().frame(frames[0])

      // Click on recaptcha checkbox and switch to default context
      await driver.findElement(By.className('recaptcha-checkbox-border')).click()
      await driver.switchTo().defaultContent()

      // Aguardar resolução manual do captcha
      const button = await waitForSubmitButton(driver)

      try {
        await button.click()
        await driver.sleep(2000)
        console.log(`[INFO] Firefox: download iniciado para ${idcnpq}`)

        // Salva o HTML da página
        const filePath = await savePageHTML(driver, idcnpq)
        console.log(`[INFO] HTML salvo em: ${filePath}`)

        await driver.sleep(3000)
        console.log(`[INFO] Firefox: download concluído para ${idcnpq}\n`)
      } catch (error) {
        console.error(`[ERRO] Falha ao fazer download para ${idcnpq}:`, error.message)
        continue // Continua para o próximo ID mesmo se houver erro
      }
    }
  } catch (error) {
    console.error('[ERRO] Falha geral no processo:', error.message)
  } finally {
    await driver.quit()
    console.log('[INFO] Navegador fechado')
  }
})()
