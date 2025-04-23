import { Builder, By, Key } from 'selenium-webdriver'
import firefox from 'selenium-webdriver/firefox.js'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import speech from '@google-cloud/speech'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
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

const ppgcc_2020 = [
  '5376253015721742',
  '3032638002357978',
  '2948406243474342',
  '4742268936279649',
  '6490014244112888',
  '8273198217435163',
  '1497269209026542',
  '5883877669437870',
  '1631238943341152',
  '5219735119295290',
  '8158963767870649',
  '2130563131041136',
  '9756167788721062',
  '6894507054383644',
  '2080791630485427',
  '1596629769697284',
  '7458287841862567',
  '1028151705135221',
  '0232988306987805',
  '9622051867672434',
  '1274395392752454',
  '9014616733186520',
  '7676631005873564',
  '9157422386900321',
  '1468872219964148',
  '0970111009687779',
  '2949449810540513',
  '2484200467965399',
]

// Define default URL
// const lattesUrl = 'http://buscatextual.cnpq.br/buscatextual/download.do?metodo=apresentar&idcnpq='
const lattesUrl = 'https://lattes.cnpq.br/'

// Configuração do cliente de reconhecimento de fala do Google
const client = new speech.SpeechClient()

async function transcribeAudio(filePath) {
  const audio = {
    content: fs.readFileSync(filePath).toString('base64'),
  }

  const request = {
    audio: audio,
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'en-US',
    },
  }

  const [response] = await client.recognize(request)
  const transcription = response.results.map(result => result.alternatives[0].transcript).join('\n')
  return transcription
}
// Iterate through all professor's id
;(async function main() {
  for (const idcnpq of ppgcc_2020) {
    const location = lattesUrl + idcnpq
    await driver.get(location)

    console.log('[INFO] Firefox: page loaded OK')

    // Find iframe tag and switch to that iframe context
    const frames = await driver.findElements(By.css('iframe'))
    await driver.switchTo().frame(frames[0])
    // process.exit()

    // Click on recaptcha checkbox and switch to default context
    await driver.findElement(By.className('recaptcha-checkbox-border')).click()
    await driver.switchTo().defaultContent()
    // Investigate submit button
    const button = await driver.findElement(By.id('submitBtn'))
    await driver.sleep(Math.random() * 1000 + 1000)

    // If true, do recaptcha
    if (!(await button.isEnabled())) {
      console.log(`[INFO] Firefox: solve recaptcha for idcnpq ${idcnpq}`)
      // Find iframe tag and switch to that iframe context
      const frames = await driver
        .findElement(By.xpath('/html/body/div[2]/div[4]'))
        .findElements(By.css('iframe'))
      await driver.switchTo().frame(frames[0])

      // Click on recaptcha audio button (alternative way to solve recaptcha)
      await driver.sleep(Math.random() * 1000 + 1000)
      await driver.findElement(By.id('recaptcha-audio-button')).click()

      // Switch to default context again
      await driver.switchTo().defaultContent()

      // Find iframe tag and switch to the last context
      const frames2 = await driver.findElements(By.css('iframe'))
      await driver.switchTo().frame(frames2[frames2.length - 1])

      // [Optional] Wait 1 second and play audio
      await driver.sleep(1000)
      await driver.findElement(By.xpath('/html/body/div/div/div[3]/div/button')).click()

      //================================================#
      // From now on: download the mp3 audio source,
      // convert to wav format,
      // feed speech recognition algorithm,
      // translate to string,
      // and send string back to recaptcha frame
      //================================================#

      // Download mp3 file
      const src = await driver.findElement(By.id('audio-source')).getAttribute('src')
      const fileName = path.join(pathToDownload, 'sample.mp3')
      const response = await fetch(src)
      const buffer = await response.buffer()
      fs.writeFileSync(fileName, buffer)
      console.log('[INFO] Firefox: download audio OK')

      // Get file and convert to wav extension
      const wavFileName = fileName.replace('.mp3', '.wav')
      execSync(`ffmpeg -i ${fileName} ${wavFileName}`)
      console.log('[INFO] Firefox: converted audio OK')

      // Submit audio to a speech recognition algorithm from Google
      const key = await transcribeAudio(wavFileName)
      console.log(`[INFO] Recaptcha code: ${key}`)

      // Send string (key) back to recaptcha page and switch to default context again
      await driver.findElement(By.id('audio-response')).sendKeys(key.toLowerCase())
      await driver.findElement(By.id('audio-response')).sendKeys(Key.ENTER)
      await driver.switchTo().defaultContent()

      // Submit solution by clicking the button
      await driver.sleep(1000)
      await driver.findElement(By.id('submitBtn')).click()
      console.log('[INFO] Firefox: download zip file OK\n')
    } else {
      // If false, just click and download zip file
      console.log(`[INFO] Firefox: no recaptcha to solve for ${idcnpq}`)
      await driver.sleep(1000)
      await button.click()
      console.log('[INFO] Firefox: download zip file OK\n')
    }
  }
  await driver.quit()
})()
