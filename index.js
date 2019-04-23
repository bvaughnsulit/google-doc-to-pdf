const {google} = require('googleapis');
const docs = google.docs({version: 'v1'});
const drive = google.drive({version: 'v3'});
const fs = require('fs');
const readline = require('readline');
const dotenv = require('dotenv').config();
const config = process.env;

(
  async () => {
    const auth = getCredentials(config)
    const docId = config.docId

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.question('Enter replacement data: ', async (input) => {
      rl.close();

      const ReplacementContent = {
        placeholder: '{{placeholder}}',
        value: input.trim()
      }

      const fileName = `${config.fileName}${ReplacementContent.value}.pdf`
      const path = `${config.filePath}${fileName}`

      await replaceStringInDoc(docId, ReplacementContent.value, ReplacementContent.placeholder, auth)    
      await exportFile(docId, path, auth)
      await replaceStringInDoc(docId, ReplacementContent.placeholder, ReplacementContent.value, auth)
    });
  }
)().catch((e) => console.error(e));




function getCredentials(credentials) {
  const oAuth2Client = new google.auth.OAuth2(
    credentials.client_id, credentials.client_secret, credentials.redirect_uri);

    const token = {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      scope: credentials.scope,
      token_type: credentials.token_type,
      expiry_date: credentials.expiry_date
    }

    oAuth2Client.setCredentials(token);
    return oAuth2Client
}


async function exportFile(fileId, path, auth) {
  const dest = fs.createWriteStream(path);
  const request = {
    fileId: fileId, 
    auth: auth,
    mimeType: 'application/pdf'
  };
  console.log('exporting file...')
  const response = await drive.files.export(request, {responseType: 'stream'});
  
  response.data
    .on('end', () => {
      console.log('Download complete.');
    })
    .on('error', err => {
      console.error('Error downloading file.');
    })
    .pipe(dest);
  return response
}


async function updateFilename(docId, name, auth) {

  const request = {
    fileId: docId, 
    resource: {
      name : name
    },
    auth: auth,
  };

  try {
    const response = await drive.files.update(request)
    console.log(response.data)
    return response.data
  } catch(e){
    console.log(e)
  }
}



async function replaceStringInDoc(docId, string, textToReplace, auth) {

  const updateRequest = {
    "replaceAllText": {
      "replaceText": string,
      "containsText": {
          "text": textToReplace,
          "matchCase": true
      }
    }
  } 

  const request = {
    documentId: docId, 
    auth: auth,
    resource: {
      requests: [updateRequest]
    }
  };

  try {
    const response = await docs.documents.batchUpdate(request)
    const replies = response.data.replies[0].replaceAllText.occurrencesChanged
    if(replies === undefined){
      throw 'placeholder not found in document'
    }
    else {
      console.log(`${replies} placeholder(s) modified.`)
      return response
    }
  } catch(e){
      throw console.log(e)
  }
}

