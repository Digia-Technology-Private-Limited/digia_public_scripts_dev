const axios = require('axios');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const { parseArgs } = require('util');


const BASE_URL = process.env.BASE_URL;
const args = process.argv.slice(2);
const projectId = args[0]; 
const branchId = args[1];


if (!projectId) {
  console.error('Please provide a projectId.');
  process.exit(1);
}

function removeIds(obj, excludeProjectId = false) {
  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (item && typeof item === 'object') {
        return filterObj(item, excludeProjectId);
      }
      return item;
    });
  } else if (obj && typeof obj === 'object') {
    return filterObj(obj, excludeProjectId);
  }
  return obj;
}

function removeNulls(obj) {
  if (Array.isArray(obj)) {
    return obj.map(removeNulls);
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null) {
        cleaned[key] = removeNulls(value);
      }
    }
    return cleaned;
  }
  return obj;
}

function filterObj(item, excludeProjectId) {
  const keysToRemove = ['id', '_id', 'branchId', 'userId','createdAt','updatedAt'];
  if (!excludeProjectId) {
    keysToRemove.push('projectId');
  }

  return Object.fromEntries(
    Object.entries(item).filter(([key]) => !keysToRemove.includes(key))
  );
}

function processPages(pages) {
  const pagesDir = path.join(__dirname, '..', 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });

  pages.forEach((page) => {
    const pageFolderName = page.displayName || page.slug || page.id;
    const pageDir = path.join(pagesDir, pageFolderName);
    const nodesDir = path.join(pageDir, 'nodes');

    fs.mkdirSync(nodesDir, { recursive: true });

    // Extract and write nodes
    const nodes = page.layout?.nodes || {};
    Object.entries(nodes).forEach(([nodeId, nodeData]) => {
      const nodeYaml = yaml.dump(removeNulls(nodeData), { sortKeys: true });
      const nodeFileName = nodeData.varName +"_" + nodeId;
      fs.writeFileSync(path.join(nodesDir, `${nodeFileName}.yaml`), nodeYaml);
    });

    // Remove layout.nodes before saving main page yaml
    const pageCopy = removeNulls({ ...page });
    if (pageCopy.layout) delete pageCopy.layout.nodes;

    const pageYaml = yaml.dump(removeIds(pageCopy), { sortKeys: true });
    fs.writeFileSync(path.join(pageDir, `${pageFolderName}.yaml`), pageYaml);

    console.log(`Created folder and files for page: ${pageFolderName}`);
  });
}
function deleteFolders(folders) {
  folders.forEach((folder) => {
    const dirPath = path.join(__dirname, '..', folder);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`Deleted folder: ${dirPath}`);
    }
  });
}

function sanitizeFileName(originalPath) {
  const noExt = originalPath.replace(path.extname(originalPath), '');
  let safeName = noExt.replace(/[\/\\]/g, '-');
  safeName = safeName.replace(/^[^a-zA-Z0-9]+/, '');
  safeName = safeName.replace(/[^a-zA-Z0-9-_]/g, '-');
  return safeName;
}

function processAndSaveData(parentFolderName, folderName, data, fileName = 'default') {
  const dirPath = path.join(__dirname, '..', parentFolderName, folderName);
  fs.mkdirSync(dirPath, { recursive: true });


if (parentFolderName !== "project") {
  data = removeIds(data);

  } else {
    data = removeIds(data, true); 
  }


  if (Array.isArray(data)) {
    data.forEach((item) => {
      const yamlData = yaml.dump(item,{ sortKeys: true });
      let currentFileName = fileName;
      
      if (item.name) currentFileName = item.name;
      if (item.displayName) currentFileName = item.displayName;
      if (item.functionName) currentFileName = item.functionName;
    
      if(folderName =="environment")
      {
        currentFileName= item.kind
      }
      if(folderName == "app-assets")
      {
  
        currentFileName = sanitizeFileName(item.assetData.localPath);
      }
      

      const yamlFilePath = path.join(dirPath, `${currentFileName}.yaml`);
      fs.writeFileSync(yamlFilePath, yamlData);

    

      console.log(`Created: ${yamlFilePath}`);
    });
  } else {
    const yamlData = yaml.dump(data,{ sortKeys: true });

    if (parentFolderName === 'design' && data.TYPOGRAPHY) {
      folderName = 'font-tokens';
    }
    if (parentFolderName === 'design' && data.THEME) {
      folderName = 'color-tokens';
    }
    if (parentFolderName === 'design' && data.APP_SETTINGS) {
      folderName = 'app-settings';
    }
    if(parentFolderName==="design" && data.APP_STATE)
    {
      folderName = 'app-state';
    }
    if(parentFolderName==="design" && data.APP_ASSETS)
      {
        folderName = 'app-assets';
      }
    if (parentFolderName === 'project' && data.appDetails?.displayName) {
      folderName = "project-details";
    }

    const yamlFilePath = path.join(dirPath, `${folderName}.yaml`);
    fs.writeFileSync(yamlFilePath, yamlData);
    console.log(`Created: ${yamlFilePath}`);
  }
}

async function fetchAllData() {
  deleteFolders(['datasources', 'components', 'design', 'functions', 'pages', 'project','widgets']);

  try {
    
    const response = await axios.post(
      `${BASE_URL}/api/v1/project/syncProjectDataForGithub`,
      { branchId },
      {
        headers: {
          projectId: projectId,
          "x-digia-github-token": token
        }
      }
    );
    

    if (!response.data || !response.data.data || !response.data.data.response) {
      console.error('Unexpected response format:', response.data);
      process.exit(1);
    }


    const { datasources, components, functions, pages, project, typography, themeData, appState, filteredAppAsset,appSettings, environments ,widgets} = response.data.data.response;

    processAndSaveData('datasources', 'rest', datasources);
    processAndSaveData('datasources', 'environment', environments);
    processAndSaveData('components', '', removeNulls(components));
    processAndSaveData('functions', '', functions);
    processPages(removeNulls(pages));


    processAndSaveData('project', '', project);
    processAndSaveData('design', 'font-tokens', typography);
    processAndSaveData('design', 'color-tokens', themeData);
    processAndSaveData('design', 'app-settings', appSettings);
    if(appState)
    {
    processAndSaveData('design', 'app-state', appState);
    }
    if(filteredAppAsset)
    {
      processAndSaveData('design', 'app-assets', filteredAppAsset);
    }
    processAndSaveData('widgets','',widgets)

    console.log(`Data for project ID ${projectId} has been fetched and saved.`);
  } catch (error) {
    console.error(`Error fetching data: ${error.message}`);
    process.exit(1); 
  }
}







fetchAllData(); 
