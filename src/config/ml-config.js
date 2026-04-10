/**
 * ML Configuration for ONNX Runtime Web integration
 * Models are loaded from HuggingFace CDN via @xenova/transformers
 */
export const MODEL_CONFIGS = [
    {
        id: 'embeddings',
        name: 'all-MiniLM-L6-v2',
        hfModel: 'Xenova/all-MiniLM-L6-v2',
        size: 23000000,
        priority: 1,
        required: true,
        task: 'feature-extraction',
    },
    {
        id: 'sentiment',
        name: 'DistilBERT-SST2',
        hfModel: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        size: 65000000,
        priority: 2,
        required: false,
        task: 'text-classification',
    },
    {
        id: 'summarization',
        name: 'Flan-T5-base',
        hfModel: 'Xenova/flan-t5-base',
        size: 250000000,
        priority: 3,
        required: false,
        task: 'text2text-generation',
    },
    {
        id: 'summarization-beta',
        name: 'Flan-T5-small',
        hfModel: 'Xenova/flan-t5-small',
        size: 60000000,
        priority: 3,
        required: false,
        task: 'text2text-generation',
    },
    {
        id: 'ner',
        name: 'BERT-NER',
        hfModel: 'Xenova/bert-base-NER',
        size: 65000000,
        priority: 4,
        required: false,
        task: 'token-classification',
    },
];
export const ML_FEATURE_FLAGS = {
    semanticClustering: true,
    mlSentiment: true,
    summarization: true,
    mlNER: true,
    insightsPanel: true,
};
export const ML_THRESHOLDS = {
    semanticClusterThreshold: 0.75,
    minClustersForML: 5,
    maxTextsPerBatch: 20,
    modelLoadTimeoutMs: 600000,
    inferenceTimeoutMs: 120000,
    memoryBudgetMB: 200,
};
export function getModelConfig(modelId) {
    return MODEL_CONFIGS.find(m => m.id === modelId);
}
export function getRequiredModels() {
    return MODEL_CONFIGS.filter(m => m.required);
}
export function getModelsByPriority() {
    return [...MODEL_CONFIGS].sort((a, b) => a.priority - b.priority);
}
