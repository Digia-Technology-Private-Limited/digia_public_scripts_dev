const axios = require('axios');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const { json } = require('stream/consumers');




const BASE_URL = process.env.BASE_URL;
const args = process.argv.slice(2); 
const token = process.env.DIGIA_TOKEN;

let projectId;
let branchName = args[0];



function readYamlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.load(content);
  } catch (error) {
    console.error(`Failed to parse YAML file ${filePath}: ${error.message}`);
    process.exit(1);
  }
}
async function collectDataFromPages(pagesPath) {
  const pages = [];

  const pageFolders = fs.readdirSync(pagesPath);
  for (const folder of pageFolders) {
    const pageFolderPath = path.join(pagesPath, folder);
    if (!fs.lstatSync(pageFolderPath).isDirectory()) continue;

    const page = {};
    const files = fs.readdirSync(pageFolderPath);

    // Read main page YAML file (same as folder name)
    const mainYamlFile = path.join(pageFolderPath, `${folder}.yaml`);
    if (fs.existsSync(mainYamlFile)) {
      Object.assign(page, readYamlFile(mainYamlFile));
    }

    // Read nodes if present
    const nodesPath = path.join(pageFolderPath, 'nodes');
    if (fs.existsSync(nodesPath) && fs.lstatSync(nodesPath).isDirectory()) {
      const nodeFiles = fs.readdirSync(nodesPath);
      page.layout = page.layout || {};
      page.layout.nodes = {};

      for (const nodeFile of nodeFiles) {
        const nodeId = nodeFile.split("_").slice(-1)[0].replace('.yaml', '');
        const nodeData = readYamlFile(path.join(nodesPath, nodeFile));
        page.layout.nodes[nodeId] = nodeData;
      }
    }

    pages.push(page);
  }

  return pages;
}

async function collectDataFromYamlFiles(folderPath, folderName) {
  const dataCollection = [];

  const traverseFolder = (currentPath) => {
    if (!fs.existsSync(currentPath)) {
      console.warn(`Warning: Folder not found - ${currentPath}`);
      return;
    }

    const files = fs.readdirSync(currentPath);

    for (const file of files) {
      const filePath = path.join(currentPath, file);

      try {
        if (fs.lstatSync(filePath).isDirectory()) {
          traverseFolder(filePath);
        } else if (path.extname(file) === '.yaml') {
          const yamlData = fs.readFileSync(filePath, 'utf8');
          const jsonData = yaml.load(yamlData);

          if(folderName=="project" )
          {
          
            projectId = jsonData.projectId
          }
        

          dataCollection.push(jsonData);
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}: ${error.message}`);
        process.exit(1)
      }
    }
  };

  traverseFolder(folderPath);

  return dataCollection;
}

async function collectAllData() {
  const folderConfigs = [
    { folderPath: path.join(__dirname, '..', 'project'), folderName: 'project' },
    { folderPath: path.join(__dirname, '..', 'datasources', 'rest'), folderName: 'datasources' },
    { folderPath: path.join(__dirname, '..', 'datasources', 'environment'), folderName: 'environments' },
    { folderPath: path.join(__dirname, '..', 'components'), folderName: 'components' },
    { folderPath: path.join(__dirname, '..', 'design','font-tokens'), folderName: 'typography' },
    { folderPath: path.join(__dirname, '..', 'design','color-tokens'), folderName: 'themeData' },
    { folderPath: path.join(__dirname, '..', 'design','app-settings'), folderName: 'appSettings' },
    { folderPath: path.join(__dirname, '..', 'design','app-state'), folderName: 'appState' },
    { folderPath: path.join(__dirname, '..', 'design','app-assets'), folderName: 'appAssets' },
    { folderPath: path.join(__dirname, '..', 'widgets'), folderName: 'widgets' },
    { folderPath: path.join(__dirname, '..', 'functions'), folderName: 'functions' },
  ];

  const allData = {};

  for (const config of folderConfigs) {
    allData[config.folderName] = await collectDataFromYamlFiles(config.folderPath, config.folderName);
  }
  const pagesPath = path.join(__dirname, '..', 'pages');
  allData['pages'] = await collectDataFromPages(pagesPath);

 

  return allData;


}

async function updateAllDataToBackend() {
  try {
    const allFolderData = await collectAllData();
 
    const updateResponse = await axios.post(
      `${BASE_URL}/api/v1/project/updateProjectDataForGithub`,
      { data: allFolderData,projectId:projectId,branchName:branchName },
      {
        headers: {
          projectid: projectId,
          "x-digia-github-token": token,
        },
      }
    );
  } catch (error) {
 
    console.error(`Error updating data to backend: ${error.message}`);
    process.exit(1)
  }
}

updateAllDataToBackend();
